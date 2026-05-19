// External scanner for AppleScript.
//
// Tree-sitter's regex-based lexer cannot disambiguate two real-world cases
// that show up in everyday AppleScript:
//
//   1. Block comments must skip over `*)` that appears inside a quoted string,
//      since a string can contain any characters. The token() regex used by
//      a pure-grammar comment rule sees `*)` literally and closes early.
//
//   2. The `alias` keyword is a prefix when followed by a value (`alias "X"`,
//      `alias (path to home folder)`), but is a plain identifier when used as
//      a property name (`alias of theItem`). Tree-sitter's GLR can't decide
//      this from the grammar alone because both interpretations consume the
//      same input until the next token.
//
// This scanner emits two external tokens that the grammar wires up:
//
//   - block_comment   — `(* ... *)`, quote-aware, optionally nested.
//   - alias_prefix    — the bare word `alias` only when the next non-space
//                       input is NOT `of`.
//
// A third token (`compound_word`, an identifier that is NOT a reserved
// keyword) was prototyped to stop multi-word compound_names from crossing
// newlines, but it broke too many legitimate parses where keyword-like
// words (e.g. `down`, `option`, `up`) are valid property names in app
// dictionaries. See git history if that approach gets revisited.

#include "tree_sitter/parser.h"
#include <wctype.h>

enum TokenType {
    BLOCK_COMMENT,
    ALIAS_PREFIX,
    PIPED_IDENTIFIER,
    KEYWORD_HANDLER_TO,
};

void *tree_sitter_applescript_external_scanner_create(void) { return NULL; }
void tree_sitter_applescript_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_applescript_external_scanner_serialize(void *payload, char *buffer) {
    (void)payload; (void)buffer;
    return 0;
}
void tree_sitter_applescript_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    (void)payload; (void)buffer; (void)length;
}

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

// Consume a quoted string body: "..." with `\` escapes. The caller already
// advanced past the opening `"`.
static void consume_string(TSLexer *lexer) {
    while (!lexer->eof(lexer)) {
        int32_t c = lexer->lookahead;
        if (c == '\\') {
            advance(lexer);
            if (!lexer->eof(lexer)) advance(lexer);
            continue;
        }
        if (c == '"') {
            advance(lexer);
            return;
        }
        advance(lexer);
    }
}

// Scan a `(* ... *)` block comment. Supports:
//   - Strings inside the comment (`"*)"` does NOT close it).
//   - Nested block comments — AppleScript Script Editor accepts these.
static bool scan_block_comment(TSLexer *lexer) {
    if (lexer->lookahead != '(') return false;
    advance(lexer);
    if (lexer->lookahead != '*') return false;
    advance(lexer);

    int depth = 1;
    while (depth > 0 && !lexer->eof(lexer)) {
        int32_t c = lexer->lookahead;
        if (c == '"') {
            advance(lexer);
            consume_string(lexer);
            continue;
        }
        if (c == '(') {
            advance(lexer);
            if (lexer->lookahead == '*') {
                advance(lexer);
                depth++;
                continue;
            }
            continue;
        }
        if (c == '*') {
            advance(lexer);
            if (lexer->lookahead == ')') {
                advance(lexer);
                depth--;
                continue;
            }
            continue;
        }
        advance(lexer);
    }
    if (depth != 0) return false;
    lexer->result_symbol = BLOCK_COMMENT;
    return true;
}

// Recognize the literal word `alias` followed by NOT `of`. Used to express
// `alias <expr>` (a value-creating prefix) without collision with the
// `alias of theItem` property reference.
//
// We accept `alias` (case-insensitive) only if the next non-whitespace token
// isn't the keyword `of`. If `of` follows, we return false so the grammar
// falls back to matching `alias` as a plain identifier.
static bool scan_alias_prefix(TSLexer *lexer) {
    const char target[] = {'a', 'l', 'i', 'a', 's'};
    for (int i = 0; i < 5; i++) {
        int32_t lo = lexer->lookahead;
        if (lo == 0) return false;
        // Case-insensitive ASCII match.
        if (lo >= 'A' && lo <= 'Z') lo += 32;
        if (lo != target[i]) return false;
        advance(lexer);
    }

    // Next character must be a word boundary — otherwise we're inside a
    // longer identifier like `aliasing` or `aliased`.
    int32_t next = lexer->lookahead;
    if (next == '_' || iswalnum(next)) return false;

    // Mark end after consuming `alias`. Now look ahead to see what follows,
    // skipping whitespace and line continuations.
    lexer->mark_end(lexer);

    while (!lexer->eof(lexer)) {
        int32_t c = lexer->lookahead;
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') { advance(lexer); continue; }
        // U+00AC ¬ — the line-continuation character in AppleScript.
        if (c == 0x00AC) { advance(lexer); continue; }
        break;
    }

    // If the next two characters spell "of" followed by a word boundary,
    // this `alias` is the property-reference variant, not the prefix.
    if (lexer->lookahead == 'o' || lexer->lookahead == 'O') {
        advance(lexer);
        if (lexer->lookahead == 'f' || lexer->lookahead == 'F') {
            advance(lexer);
            int32_t after = lexer->lookahead;
            if (after == 0 || after == ' ' || after == '\t' || after == '\n' ||
                after == '\r' || (after != '_' && !iswalnum(after))) {
                return false;
            }
        }
    }

    lexer->result_symbol = ALIAS_PREFIX;
    return true;
}

// Scan |name with any chars except |, newline, or EOF|. The caller must have
// confirmed the lookahead is '|'. Returns true (and sets PIPED_IDENTIFIER)
// only on a successfully closed `|...|`. A newline or EOF inside the bars
// causes rejection so we don't silently swallow the rest of the file.
// Empty `||` is rejected — AppleScript doesn't allow zero-length names.
static bool scan_piped_identifier(TSLexer *lexer) {
    if (lexer->lookahead != '|') return false;
    advance(lexer);  // consume opening |

    bool saw_any = false;
    while (!lexer->eof(lexer)) {
        int32_t c = lexer->lookahead;
        if (c == '\n' || c == '\r') return false;  // unterminated
        if (c == '|') {
            if (!saw_any) return false;  // empty `||` is not an identifier
            advance(lexer);  // consume closing |
            lexer->result_symbol = PIPED_IDENTIFIER;
            return true;
        }
        saw_any = true;
        advance(lexer);
    }
    return false;  // EOF before closing |
}

// `to` is overloaded in AppleScript. Recognise it as a HANDLER opener
// only when it is at the start of a logical line (column 0) AND followed
// by an identifier (or whitespace). `move x to trash` and `from N to M`
// have `to` mid-line, so they fall through to the regular keyword.
//
// We deliberately don't peek ahead at the next word — the column check
// alone disambiguates cleanly in practice. A user who writes a handler
// header indented (rare but legal) will fall back to the regular `to`,
// and the rest of the grammar still parses the header correctly because
// `to` is allowed in non-handler positions too.
static bool scan_keyword_handler_to(TSLexer *lexer) {
    // Must be at column 0. tree-sitter's extras already consumed
    // leading whitespace before we get here, so get_column reports the
    // column of the FIRST non-whitespace character on the line — which
    // for a handler opener is `t`.
    if (lexer->get_column(lexer) != 0) return false;

    // Match the word `to` case-insensitively.
    const char target[] = {'t', 'o'};
    for (int i = 0; i < 2; i++) {
        int32_t c = lexer->lookahead;
        if (c >= 'A' && c <= 'Z') c += 32;
        if (c != target[i]) return false;
        advance(lexer);
    }

    // Word boundary check — refuse to consume a partial token like `toString`.
    int32_t after = lexer->lookahead;
    if (after == '_' || iswalnum(after)) return false;

    lexer->result_symbol = KEYWORD_HANDLER_TO;
    return true;
}

bool tree_sitter_applescript_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    (void)payload;

    // For block_comment we MUST skip newlines — otherwise the internal lexer
    // races us to the first significant character and consumes `(` as a
    // literal `(` token before we ever see it. For alias_prefix and
    // compound_word we deliberately do NOT skip newlines, so a multi-word
    // compound_name can't reach across a newline into the next statement.
    if (valid_symbols[BLOCK_COMMENT]) {
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
               lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
               lexer->lookahead == 0x00AC) {
            skip(lexer);
        }
        if (lexer->lookahead == '(') {
            return scan_block_comment(lexer);
        }
    } else {
        // Skip spaces and tabs only — newlines stop a compound_name.
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
            skip(lexer);
        }
    }

    if (valid_symbols[KEYWORD_HANDLER_TO] &&
        (lexer->lookahead == 't' || lexer->lookahead == 'T')) {
        if (scan_keyword_handler_to(lexer)) return true;
        // Not at column 0 — fall through; the regular keyword_to from the
        // grammar lexer handles non-handler `to`.
    }

    if (valid_symbols[ALIAS_PREFIX] &&
        (lexer->lookahead == 'a' || lexer->lookahead == 'A')) {
        return scan_alias_prefix(lexer);
    }

    if (valid_symbols[PIPED_IDENTIFIER] && lexer->lookahead == '|') {
        return scan_piped_identifier(lexer);
    }

    return false;
}
