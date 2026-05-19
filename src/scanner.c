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
//   - `block_comment`   — `(* ... *)`, quote-aware, optionally nested.
//   - `alias_prefix`    — the bare word `alias` only when the next non-space
//                         input is NOT `of`.

#include "tree_sitter/parser.h"
#include <wctype.h>

enum TokenType {
    BLOCK_COMMENT,
    ALIAS_PREFIX,
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

bool tree_sitter_applescript_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    (void)payload;
    // Skip leading whitespace (including newlines and the line-continuation
    // glyph). If we don't, the internal lexer races us to the first
    // significant character — it will consume `(` as a literal `(` token
    // before our `scan_block_comment` ever gets to see it.
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
           lexer->lookahead == 0x00AC) {
        skip(lexer);
    }

    if (valid_symbols[BLOCK_COMMENT] && lexer->lookahead == '(') {
        return scan_block_comment(lexer);
    }

    if (valid_symbols[ALIAS_PREFIX] &&
        (lexer->lookahead == 'a' || lexer->lookahead == 'A')) {
        return scan_alias_prefix(lexer);
    }

    return false;
}
