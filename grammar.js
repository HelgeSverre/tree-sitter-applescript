/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// AppleScript grammar with block structure support
// AppleScript's English-like syntax is inherently ambiguous for LR parsing,
// so we use error recovery and loose matching for expressions.

// Helper for case-insensitive keywords
const ci = (word) => {
  return new RegExp(
    word
      .split("")
      .map((char) => {
        if (/[a-zA-Z]/.test(char)) {
          return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
      })
      .join("")
  );
};

module.exports = grammar({
  name: "applescript",

  // Treat `identifier` as the canonical "word" rule so every `ci(...)` keyword
  // token only matches as a whole word. Without this, the lexer happily
  // tokenizes `me` inside `home`, `of` inside `office`, etc.
  word: ($) => $.identifier,

  // Note: `¬` (U+00AC) is AppleScript's line-continuation glyph, not logical
  // NOT (that's the keyword `not`). Treat as whitespace so a trailing `¬`
  // transparently joins the next line.
  extras: ($) => [/\s/, /¬/, $.comment],

  conflicts: ($) => [
    [$.record, $.list],
    // compound_name's optional 2nd/3rd identifier creates internal ambiguity
    // (does `current view` stop at `current` or eat `view` too?). GLR keeps
    // both alive; whichever extends into a valid property_reference wins.
    [$.compound_name],
    [$._expression, $.compound_name],
    [$._expression],
    [$.object_specifier, $.property_reference],
    [$.else_clause],
    [$.else_if_clause],
    [$.if_block, $.if_simple_statement],
    // `file type of x` should be property_reference(compound_name(file type), x),
    // not index_expression(file, property_reference(type, x)).
    [$.index_expression, $.property_reference],
    [$.handler_definition, $._expression, $.compound_name],
    [$.handler_definition, $._expression],
  ],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.handler_definition,
        $.script_block,
        $.tell_block,
        $.tell_simple_statement,
        $.if_block,
        $.if_simple_statement,
        $.repeat_block,
        $.try_block,
        $.considering_block,
        $.ignoring_block,
        $.timeout_block,
        $.using_terms_block,
        $.use_statement,
        $.property_declaration,
        $.global_declaration,
        $.local_declaration,
        $.set_statement,
        $.copy_statement,
        $.return_statement,
        $.error_statement,
        $.exit_statement,
        $.continue_statement,
        $.log_statement,
        $.implicit_run_end,
        $.command_call,
        $._expression
      ),

    // `end run` at the bottom of a script with no matching `on run` —
    // AppleScript wraps top-level statements in an implicit run handler, and
    // many real scripts put `end run` at the bottom for clarity. Use a single
    // multi-word token so the bare `keyword_end` rule (used by every other
    // block) isn't perturbed.
    implicit_run_end: ($) => token(seq(ci("end"), /\s+/, ci("run"))),

    // ==================== HANDLERS ====================

    // Handler definition:
    //   `on greet(name) … end greet`
    //   `on opening folder fld … end opening folder`
    //   `on adding folder items to fld after receiving items … end …`
    //   `on sortList:theList … end sortList:`
    //   `on splitString:s byDelim:d … end splitString:byDelim:`
    //
    // Three header shapes:
    //   1. Regular: identifier + parenthesized params (or bare identifier param)
    //   2. Folder-Action: multi-word event + folder + prepositional clauses
    //   3. ObjC-bridge: identifier `:` ident (identifier `:` ident)+
    handler_definition: ($) =>
      prec.right(
        choice(
          // Regular and Folder-Action shapes
          seq(
            field("keyword", $.keyword_function),
            field("name", choice($.identifier, $.folder_action_event)),
            optional(choice($.parameter_list, $.identifier)),
            repeat($.folder_action_param),
            optional($.given_clause),
            repeat($._item),
            $.keyword_end,
            optional(choice($.identifier, $.folder_action_event))
          ),
          // ObjC-style selector handler: each selector word is followed by
          // `:identifier`. The end clause repeats the selector words with
          // trailing colons but no parameters.
          $.objc_handler_definition
        )
      ),

    objc_handler_definition: ($) =>
      prec.right(seq(
        field("keyword", $.keyword_function),
        $.identifier,
        ":",
        $.identifier,
        repeat(seq($.identifier, ":", $.identifier)),
        repeat($._item),
        $.keyword_end,
        optional(seq($.identifier, ":", repeat(seq($.identifier, ":"))))
      )),

    // Multi-word Folder Action event names. Single-token so the rest of the
    // header doesn't have to peek ahead at individual words.
    folder_action_event: ($) =>
      token(
        choice(
          seq(ci("adding"), /\s+/, ci("folder"), /\s+/, ci("items"), /\s+/, ci("to")),
          seq(ci("removing"), /\s+/, ci("folder"), /\s+/, ci("items"), /\s+/, ci("from")),
          seq(ci("moving"), /\s+/, ci("folder"), /\s+/, ci("window"), /\s+/, ci("for")),
          seq(ci("closing"), /\s+/, ci("folder"), /\s+/, ci("window"), /\s+/, ci("for")),
          seq(ci("opening"), /\s+/, ci("folder"), /\s+/, ci("window")),
          seq(ci("opening"), /\s+/, ci("folder")),
          seq(ci("closing"), /\s+/, ci("folder")),
          seq(ci("adding"), /\s+/, ci("folder"), /\s+/, ci("items")),
          seq(ci("removing"), /\s+/, ci("folder"), /\s+/, ci("items"))
        )
      ),

    // Prepositional argument used by Folder Action handlers and similar:
    // `after receiving items`, `from rect`, the bare folder identifier.
    folder_action_param: ($) =>
      seq(
        token(
          choice(
            seq(ci("after"), /\s+/, ci("receiving")),
            ci("from"),
            ci("for")
          )
        ),
        $.identifier
      ),

    keyword_on: ($) => token(ci("on")),
    keyword_handler_to: ($) => token(ci("to")),
    keyword_function: ($) => choice($.keyword_on, $.keyword_handler_to),

    keyword_end: ($) => token(ci("end")),

    parameter_list: ($) =>
      prec(
        2,
        seq(
          "(",
          optional(seq($.identifier, repeat(seq(",", $.identifier)))),
          ")"
        )
      ),

    // Labeled parameters: given name:paramName, age:paramAge
    given_clause: ($) =>
      seq(
        token(ci("given")),
        $.labeled_parameter,
        repeat(seq(",", $.labeled_parameter))
      ),

    labeled_parameter: ($) =>
      seq(
        field("label", $.identifier),
        ":",
        field("name", $.identifier)
      ),

    // ==================== SCRIPT OBJECTS ====================

    // Script block: script [name] ... end script
    script_block: ($) =>
      prec.right(
        1,
        seq(
          field("keyword", $.keyword_script),
          optional(field("name", $.identifier)),
          optional($.parent_clause),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("script")))
        )
      ),

    keyword_script: ($) => token(ci("script")),

    // Parent inheritance: script MyScript parent MyParent
    parent_clause: ($) =>
      seq(
        token(ci("parent")),
        $._expression
      ),

    // ==================== TELL BLOCK ====================

    // Tell block: tell target ... end tell
    tell_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_tell),
          field("target", $._expression),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("tell")))
        )
      ),

    // One-line tell: tell application "Finder" to activate
    tell_simple_statement: ($) =>
      prec.right(
        10,
        seq(
          field("keyword", $.keyword_tell),
          field("target", $.reference),
          $.keyword_to,
          field("action", choice(
            $.command_call,
            $.set_statement,
            $.return_statement,
            $._expression
          ))
        )
      ),

    keyword_to: ($) => token(ci("to")),

    keyword_tell: ($) => token(ci("tell")),

    // ==================== IF BLOCK ====================

    // If block: if condition then ... [else if ... then ...] [else ...] end [if]
    // Higher precedence than `if_simple_statement` so a multi-line if with an
    // `end if` doesn't get sliced into `if_simple_statement` + orphaned `end`.
    if_block: ($) =>
      prec.right(
        3,
        seq(
          field("keyword", $.keyword_if),
          field("condition", $._expression),
          $.keyword_then,
          repeat($._item),
          repeat($.else_if_clause),
          optional($.else_clause),
          $.keyword_end,
          optional(token(ci("if")))
        )
      ),

    // One-line if: `if x then return y`. Lower precedence than `if_block` so
    // a multi-line `if/then/.../end if` doesn't get sliced into a simple if
    // plus an orphaned `end if`.
    if_simple_statement: ($) =>
      prec.right(
        1,
        seq(
          field("keyword", $.keyword_if),
          field("condition", $._expression),
          $.keyword_then,
          field("then_action", $._item)
        )
      ),

    keyword_if: ($) => token(ci("if")),
    keyword_then: ($) => token(ci("then")),

    else_if_clause: ($) =>
      seq(
        $.keyword_else_if,
        field("condition", $._expression),
        $.keyword_then,
        repeat($._item)
      ),

    keyword_else_if: ($) => token(seq(ci("else"), /\s+/, ci("if"))),

    else_clause: ($) => seq($.keyword_else, repeat($._item)),

    keyword_else: ($) => token(ci("else")),

    // ==================== REPEAT BLOCK ====================

    // Repeat block: repeat ... end repeat
    repeat_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_repeat),
          optional($._repeat_clause),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("repeat")))
        )
      ),

    keyword_repeat: ($) => token(ci("repeat")),

    _repeat_clause: ($) =>
      choice(
        seq(
          token(ci("with")),
          $.identifier,
          token(ci("from")),
          $._expression,
          token(ci("to")),
          $._expression,
          optional(seq(token(ci("by")), $._expression))
        ),
        seq(token(ci("with")), $.identifier, token(ci("in")), $._expression),
        seq(token(ci("while")), $._expression),
        seq(token(ci("until")), $._expression),
        seq($._expression, token(ci("times")))
      ),

    // ==================== TRY BLOCK ====================

    // Try block: try ... on error [errMsg] [number errNum] ... end try
    try_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_try),
          repeat($._item),
          optional($.error_handler),
          $.keyword_end,
          optional(token(ci("try")))
        )
      ),

    keyword_try: ($) => token(ci("try")),

    error_handler: ($) =>
      prec.right(
        1,
        seq(
          $.keyword_on_error,
          optional($.error_parameters),
          repeat($._item)
        )
      ),

    error_parameters: ($) =>
      prec(
        2,
        choice(
          seq($.identifier, optional(seq(token(ci("number")), $.identifier))),
          seq(token(ci("number")), $.identifier)
        )
      ),

    keyword_on_error: ($) => token(seq(ci("on"), /\s+/, ci("error"))),

    // ==================== CONSIDERING/IGNORING BLOCKS ====================

    // Considering block: considering attribute [, attribute]... ... end considering
    considering_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_considering),
          $.text_attribute,
          repeat(seq(",", $.text_attribute)),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("considering")))
        )
      ),

    keyword_considering: ($) => token(ci("considering")),

    // Ignoring block: ignoring attribute [, attribute]... ... end ignoring
    ignoring_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_ignoring),
          $.text_attribute,
          repeat(seq(",", $.text_attribute)),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("ignoring")))
        )
      ),

    keyword_ignoring: ($) => token(ci("ignoring")),

    text_attribute: ($) =>
      token(
        choice(
          ci("case"),
          ci("diacriticals"),
          ci("hyphens"),
          ci("punctuation"),
          ci("white space"),
          seq(ci("application"), /\s+/, ci("responses"))
        )
      ),

    // ==================== TIMEOUT BLOCK ====================

    // With timeout block: with timeout [of] N seconds ... end timeout
    timeout_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_with_timeout),
          optional(token(ci("of"))),
          $._expression,
          token(ci("seconds")),
          repeat($._item),
          $.keyword_end,
          optional(token(ci("timeout")))
        )
      ),

    keyword_with_timeout: ($) => token(seq(ci("with"), /\s+/, ci("timeout"))),

    // ==================== USING TERMS FROM BLOCK ====================

    // Using terms from block: using terms from application "X" ... end using terms from
    using_terms_block: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_using_terms_from),
          field("source", $._expression),
          repeat($._item),
          $.keyword_end,
          optional(token(seq(ci("using"), /\s+/, ci("terms"), /\s+/, ci("from"))))
        )
      ),

    keyword_using_terms_from: ($) => token(seq(ci("using"), /\s+/, ci("terms"), /\s+/, ci("from"))),

    // ==================== USE STATEMENTS ====================

    // Use statement: use framework "X" / use scripting additions / use application "X"
    use_statement: ($) =>
      seq(
        $.keyword_use,
        choice(
          seq(token(ci("AppleScript")), optional(seq(token(ci("version")), $.string))),
          seq(token(ci("framework")), $.string),
          seq(token(ci("scripting")), token(ci("additions"))),
          seq(token(ci("application")), $.string)
        )
      ),

    keyword_use: ($) => token(ci("use")),

    // ==================== DECLARATIONS ====================

    // Property declaration
    property_declaration: ($) =>
      seq(
        $.keyword_property,
        field("name", $.identifier),
        ":",
        field("value", $._expression)
      ),

    keyword_property: ($) => token(ci("property")),

    // Global declaration
    global_declaration: ($) =>
      seq(
        $.keyword_global,
        $.identifier,
        repeat(seq(",", $.identifier))
      ),

    keyword_global: ($) => token(ci("global")),

    // Local declaration
    local_declaration: ($) =>
      seq(
        $.keyword_local,
        $.identifier,
        repeat(seq(",", $.identifier))
      ),

    keyword_local: ($) => token(ci("local")),

    // ==================== STATEMENTS ====================

    // Set statement
    // `set <target> to <value>`. Target can be a multi-word property name
    // (`folder actions enabled`, `current view`).
    set_statement: ($) =>
      seq(
        $.keyword_set,
        field("variable", choice($._expression, $.compound_name)),
        token(ci("to")),
        field("value", $._expression)
      ),

    keyword_set: ($) => token(ci("set")),

    // Copy statement
    copy_statement: ($) =>
      seq(
        $.keyword_copy,
        field("value", $._expression),
        token(ci("to")),
        field("variable", $._expression)
      ),

    keyword_copy: ($) => token(ci("copy")),

    // Return statement
    return_statement: ($) =>
      prec.right(
        seq(
          $.keyword_return,
          optional($._expression)
        )
      ),

    keyword_return: ($) => token(ci("return")),

    // Error statement: error "message" number N
    error_statement: ($) =>
      prec.right(
        seq(
          $.keyword_error,
          optional($._expression),
          optional(seq(token(ci("number")), $._expression)),
          optional(seq(token(ci("from")), $._expression)),
          optional(seq(token(ci("to")), $._expression)),
          optional(seq(token(ci("partial")), token(ci("result")), $._expression))
        )
      ),

    keyword_error: ($) => token(ci("error")),

    // Exit statement
    exit_statement: ($) =>
      prec.right(
        seq(
          $.keyword_exit,
          optional(token(ci("repeat")))
        )
      ),

    keyword_exit: ($) => token(ci("exit")),

    // Continue statement
    continue_statement: ($) => $.keyword_continue,

    keyword_continue: ($) => token(ci("continue")),

    // Log statement
    log_statement: ($) =>
      seq(
        $.keyword_log,
        $._expression
      ),

    keyword_log: ($) => token(ci("log")),

    // ==================== COMMAND CALLS ====================

    // Common AppleScript commands
    command_call: ($) =>
      prec.right(
        seq(
          field("command", $.command_name),
          optional(field("argument", $._expression)),
          repeat($.command_parameter)
        )
      ),

    command_name: ($) =>
      token(
        choice(
          // Standard additions
          seq(ci("display"), /\s+/, ci("dialog")),
          seq(ci("display"), /\s+/, ci("alert")),
          seq(ci("display"), /\s+/, ci("notification")),
          seq(ci("choose"), /\s+/, ci("file")),
          seq(ci("choose"), /\s+/, ci("folder")),
          seq(ci("choose"), /\s+/, ci("from"), /\s+/, ci("list")),
          seq(ci("choose"), /\s+/, ci("color")),
          seq(ci("do"), /\s+/, ci("shell"), /\s+/, ci("script")),
          seq(ci("run"), /\s+/, ci("script")),
          seq(ci("load"), /\s+/, ci("script")),
          seq(ci("store"), /\s+/, ci("script")),
          seq(ci("path"), /\s+/, ci("to")),
          seq(ci("info"), /\s+/, ci("for")),
          seq(ci("list"), /\s+/, ci("folder")),
          seq(ci("list"), /\s+/, ci("disks")),
          seq(ci("system"), /\s+/, ci("info")),
          seq(ci("system"), /\s+/, ci("attribute")),
          seq(ci("current"), /\s+/, ci("date")),
          seq(ci("time"), /\s+/, ci("to"), /\s+/, ci("GMT")),
          seq(ci("random"), /\s+/, ci("number")),
          seq(ci("round")),
          seq(ci("read")),
          seq(ci("write")),
          seq(ci("open"), /\s+/, ci("for"), /\s+/, ci("access")),
          seq(ci("close"), /\s+/, ci("access")),
          seq(ci("get"), /\s+/, ci("eof")),
          seq(ci("set"), /\s+/, ci("eof")),
          seq(ci("clipboard"), /\s+/, ci("info")),
          seq(ci("set"), /\s+/, ci("the"), /\s+/, ci("clipboard"), /\s+/, ci("to")),
          seq(ci("the"), /\s+/, ci("clipboard")),
          seq(ci("ASCII"), /\s+/, ci("number")),
          seq(ci("ASCII"), /\s+/, ci("character")),
          seq(ci("offset")),
          seq(ci("summarize")),
          seq(ci("beep")),
          seq(ci("delay")),
          seq(ci("say")),
          // Application commands
          ci("activate"),
          ci("launch"),
          ci("quit"),
          ci("reopen"),
          ci("run"),
          ci("open"),
          ci("close"),
          ci("save"),
          ci("delete"),
          ci("duplicate"),
          ci("exists"),
          ci("make"),
          ci("move"),
          ci("count"),
          ci("get"),
          ci("print")
        )
      ),

    // Named parameters for commands: with title "X", buttons {"OK"}, etc.
    command_parameter: ($) =>
      seq(
        field("name", $.parameter_name),
        field("value", $._expression)
      ),

    parameter_name: ($) =>
      token(
        choice(
          // Common parameter names
          seq(ci("with"), /\s+/, ci("title")),
          seq(ci("with"), /\s+/, ci("prompt")),
          seq(ci("with"), /\s+/, ci("icon")),
          seq(ci("with"), /\s+/, ci("properties")),
          seq(ci("without"), /\s+/, ci("hidden"), /\s+/, ci("answer")),
          seq(ci("default"), /\s+/, ci("answer")),
          seq(ci("default"), /\s+/, ci("button")),
          seq(ci("default"), /\s+/, ci("color")),
          seq(ci("default"), /\s+/, ci("name")),
          seq(ci("default"), /\s+/, ci("location")),
          seq(ci("default"), /\s+/, ci("items")),
          seq(ci("giving"), /\s+/, ci("up"), /\s+/, ci("after")),
          ci("buttons"),
          ci("using"),
          ci("at"),
          ci("to"),
          ci("from"),
          ci("for"),
          ci("in"),
          ci("with"),
          ci("without"),
          ci("as"),
          ci("by"),
          ci("thru"),
          ci("through"),
          ci("before"),
          ci("after"),
          ci("instead"), seq(/\s+/, ci("of")),
          ci("into"),
          ci("onto"),
          ci("between"),
          ci("against"),
          ci("above"),
          ci("below"),
          ci("aside"), seq(/\s+/, ci("from")),
          ci("around"),
          ci("beside"),
          ci("beneath"),
          ci("under"),
          ci("over"),
          ci("named"),
          seq(ci("starting"), /\s+/, ci("at")),
          seq(ci("multiple"), /\s+/, ci("selections"), /\s+/, ci("allowed")),
          seq(ci("empty"), /\s+/, ci("selection"), /\s+/, ci("allowed")),
          seq(ci("of"), /\s+/, ci("type")),
          seq(ci("invisibles"))
        )
      ),

    // ==================== EXPRESSIONS ====================

    // Expressions. `the` is decorative in AppleScript (`set the x to the name
    // of the file`); it may appear before any noun phrase. We consume an
    // optional `the` at the start of every expression so it doesn't have to
    // be sprinkled through every other rule.
    _expression: ($) =>
      seq(
        optional($.the_keyword),
        choice(
          $.binary_expression,
          $.unary_expression,
          $.string,
          $.number,
          $.boolean,
          $.missing_value,
          $.null_value,
          $.current_application,
          $.current_date,
          $.me_reference,
          $.it_reference,
          $.result_reference,
          $.list,
          $.record,
          $.parenthesized_expression,
          $.reference,
          $.object_specifier,
          $.property_reference,
          $.index_expression,
          $.range_expression,
          $.coercion_expression,
          $.concatenation,
          $.reference_to_expression,
          $.date_literal,
          $.objc_selector_call,
          $.possessive_expression,
          $.new_specifier,
          $.raw_data,
          $.my_expression,
          $.identifier
        )
      ),

    // `my <expr>` — script self-reference, used to call own handlers / refer
    // to own properties from inside a tell block: `my resolve_conflicts(x)`.
    // Bumped precedence so the leading `my` keyword wins over the bare-
    // identifier path through `_expression`.
    my_expression: ($) =>
      prec.right(10, seq($.keyword_my, $._expression)),

    keyword_my: ($) => token(ci("my")),

    // AppleScript raw data literal: «class fold», «data utxt201C», etc.
    // Used in decompiled scripts for special types/strings. Built as a token
    // sequence rather than a single regex because tree-sitter's lexer
    // generation can drop tokens whose regex includes non-ASCII anchor
    // characters.
    raw_data: ($) =>
      token(seq("«", /[A-Za-z0-9 ]+/, "»")),

    the_keyword: ($) => token(ci("the")),

    // `new <element_type>` — the argument shape used by `make`, e.g.
    // `make new folder at … with properties {…}` and `make new document`.
    new_specifier: ($) =>
      prec.right(seq(token(ci("new")), $.element_type)),

    // Possessive accessor: `x's y` — common in modern AppleScript and
    // dominant in ASObjC (`current application's NSString`). The right side
    // is `compound_name` so multi-word app-dictionary property names
    // (`AppleScript's text item delimiters`) parse as a single accessor.
    // Higher precedence than binary operators so `x's y + z` is `(x's y) + z`.
    possessive_expression: ($) =>
      prec.left(
        7,
        seq($._expression, $.possessive, $.compound_name)
      ),

    // ObjC bridge method call: `receiver's selector:arg [label:arg ...]`.
    // Slightly higher precedence than plain possessive so the `:arg` tail wins
    // when present.
    objc_selector_call: ($) =>
      prec.left(
        8,
        seq(
          $._expression,
          $.possessive,
          $.identifier,
          ":",
          $._expression,
          repeat(seq($.identifier, ":", $._expression))
        )
      ),

    possessive: ($) => token("'s"),

    // `a reference to <expr>` — three-word prefix that wraps an expression
    // as a live reference. Common in ASObjC: `property NS : a reference to current application's NSString`.
    // Use a single multi-word token so a bare `a` identifier (`a or b`) is unaffected.
    reference_to_expression: ($) =>
      prec.right(seq(
        token(seq(ci("a"), /\s+/, ci("reference"), /\s+/, ci("to"))),
        $._expression
      )),

    // Date literal: `date "Saturday, January 1, 2000 at 12:00:00 AM"`
    date_literal: ($) =>
      seq(token(ci("date")), $.string),

    // Parens can wrap a command call when used as a value:
    // `(path to home folder)`, `(do shell script "uname -m")`. They can also
    // serve as the argument list of a handler call: `f(x, y, z)`. Otherwise
    // plain expressions.
    parenthesized_expression: ($) =>
      seq(
        "(",
        optional(seq(
          choice($.command_call, $._expression),
          repeat(seq(",", choice($.command_call, $._expression)))
        )),
        ")"
      ),

    // List literal — items can be plain expressions or multi-word application
    // constants like `Eight channel` (Image Events' colorspace names).
    list: ($) =>
      seq(
        "{",
        optional(seq($._list_item, repeat(seq(",", $._list_item)))),
        "}"
      ),

    _list_item: ($) => choice($._expression, $.compound_name),

    record: ($) => seq("{", $.record_entry, repeat(seq(",", $.record_entry)), "}"),

    record_entry: ($) => seq($.identifier, ":", $._expression),

    reference: ($) =>
      seq(
        $.keyword_application,
        $.string
      ),

    keyword_application: ($) => token(ci("application")),

    // ==================== BINARY EXPRESSIONS ====================

    // Binary operators with precedence
    binary_expression: ($) =>
      choice(
        // Comparison operators (lowest precedence)
        prec.left(1, seq($._expression, $.comparison_operator, $._expression)),
        // Logical operators
        prec.left(2, seq($._expression, $.logical_operator, $._expression)),
        // Arithmetic operators
        prec.left(3, seq($._expression, $.additive_operator, $._expression)),
        prec.left(4, seq($._expression, $.multiplicative_operator, $._expression)),
        // Exponentiation (right associative, highest precedence)
        prec.right(5, seq($._expression, "^", $._expression))
      ),

    comparison_operator: ($) =>
      token(
        choice(
          "=",
          "≠",
          "/=",
          "<",
          ">",
          "≤",
          "<=",
          "≥",
          ">=",
          ci("is equal to"),
          ci("is not equal to"),
          ci("equals"),
          ci("is less than"),
          ci("is greater than"),
          ci("is less than or equal to"),
          ci("is greater than or equal to"),
          ci("comes before"),
          ci("comes after"),
          ci("is"),
          ci("is not"),
          ci("contains"),
          ci("does not contain"),
          ci("starts with"),
          ci("begins with"),
          ci("ends with"),
          ci("does not start with"),
          ci("does not begin with"),
          ci("does not end with"),
          ci("is in"),
          ci("is not in")
        )
      ),

    logical_operator: ($) =>
      token(choice(ci("and"), ci("or"))),

    additive_operator: ($) => token(choice("+", "-")),

    multiplicative_operator: ($) =>
      token(choice("*", "/", "÷", ci("mod"), ci("div"))),

    // Unary operators
    unary_expression: ($) =>
      prec.right(6, seq($.unary_operator, $._expression)),

    unary_operator: ($) => token(choice(ci("not"), "-")),

    // String concatenation
    concatenation: ($) =>
      prec.left(2, seq($._expression, "&", $._expression)),

    // ==================== OBJECT SPECIFIERS ====================

    // Object specifier: `window 1 of application "Finder"`, also `every word`
    // (no `of` tail). Optional trailing `whose | where` filter:
    // `every file of home whose size > 1000`.
    // The `_expression` slot accepts compound_name so multi-word element types
    // (`UI element`, `static text`) parse cleanly.
    object_specifier: ($) =>
      prec.left(
        3,
        seq(
          $.specifier_prefix,
          choice($._expression, $.compound_name),
          optional(seq(token(ci("of")), $._expression)),
          optional($.whose_clause)
        )
      ),

    // Filter clause for object specifiers: `every file whose name ends with ".txt"`
    whose_clause: ($) =>
      prec.right(seq(
        token(choice(ci("whose"), ci("where"))),
        $._expression
      )),

    specifier_prefix: ($) =>
      token(
        choice(
          ci("first"),
          ci("second"),
          ci("third"),
          ci("fourth"),
          ci("fifth"),
          ci("sixth"),
          ci("seventh"),
          ci("eighth"),
          ci("ninth"),
          ci("tenth"),
          ci("last"),
          ci("front"),
          ci("back"),
          ci("middle"),
          ci("any"),
          ci("some"),
          ci("every")
        )
      ),

    // Property reference: `name of theFile`, also multi-word app-dictionary
    // properties like `current view of window`, `name extension of theFile`,
    // `folder actions enabled`. The leading words come from application
    // dictionaries that tree-sitter cannot inspect statically, so we accept
    // 1–3 consecutive identifiers as the property name.
    property_reference: ($) =>
      prec.left(
        3,
        seq(
          $.compound_name,
          token(ci("of")),
          $._expression
        )
      ),

    // A 1–3-word name. The first word may be an `element_type` (`file type`,
    // `folder action`) which the lexer would otherwise greedily eat for an
    // `index_expression`. Higher precedence than the bare-identifier path so
    // when `of` follows, the multi-word interpretation wins via the explicit
    // conflict declaration.
    compound_name: ($) =>
      prec.right(seq(
        choice($.identifier, $.element_type),
        optional($.identifier),
        optional($.identifier)
      )),

    // Index expression: `item 1`, `window 2`, `paragraph 3 of foo`.
    // The optional `of <expr>` tail makes `item 1 of FS` parse as a single
    // object reference rather than splitting after `item 1`.
    index_expression: ($) =>
      prec.left(
        4,
        seq(
          $.element_type,
          $._expression,
          optional(seq(token(ci("of")), $._expression))
        )
      ),

    element_type: ($) =>
      token(
        choice(
          // Common single-word element types
          ci("item"),
          ci("word"),
          ci("character"),
          ci("paragraph"),
          ci("line"),
          ci("window"),
          ci("document"),
          ci("file"),
          ci("folder"),
          ci("disk"),
          ci("process"),
          ci("button"),
          ci("menu"),
          ci("row"),
          ci("column"),
          ci("cell"),
          // Common multi-word element types from Finder, System Events,
          // and Image Events dictionaries that real scripts use freely.
          seq(ci("text"), /\s+/, ci("item")),
          seq(ci("menu"), /\s+/, ci("item")),
          seq(ci("text"), /\s+/, ci("field")),
          seq(ci("application"), /\s+/, ci("file")),
          seq(ci("application"), /\s+/, ci("process")),
          seq(ci("document"), /\s+/, ci("file")),
          seq(ci("scroll"), /\s+/, ci("bar")),
          seq(ci("scroll"), /\s+/, ci("area")),
          seq(ci("static"), /\s+/, ci("text")),
          seq(ci("UI"), /\s+/, ci("element")),
          seq(ci("menu"), /\s+/, ci("bar")),
          seq(ci("menu"), /\s+/, ci("bar"), /\s+/, ci("item")),
          seq(ci("tool"), /\s+/, ci("bar")),
          seq(ci("title"), /\s+/, ci("bar")),
          seq(ci("status"), /\s+/, ci("bar")),
          seq(ci("text"), /\s+/, ci("area")),
          seq(ci("color"), /\s+/, ci("well")),
          seq(ci("combo"), /\s+/, ci("box")),
          seq(ci("check"), /\s+/, ci("box")),
          seq(ci("radio"), /\s+/, ci("button")),
          seq(ci("radio"), /\s+/, ci("group")),
          seq(ci("pop"), /\s+/, ci("up"), /\s+/, ci("button")),
          seq(ci("disclosure"), /\s+/, ci("triangle")),
          seq(ci("incrementor"), /\s+/, ci("button"))
        )
      ),

    // Range expression: items 1 thru 5
    range_expression: ($) =>
      prec.left(
        3,
        seq(
          $.element_type,
          $._expression,
          $.range_operator,
          $._expression
        )
      ),

    range_operator: ($) => token(choice(ci("thru"), ci("through"))),

    // Coercion: x as text, y as integer
    coercion_expression: ($) =>
      prec.left(
        1,
        seq(
          $._expression,
          token(ci("as")),
          $.type_specifier
        )
      ),

    type_specifier: ($) =>
      token(
        choice(
          ci("text"),
          ci("string"),
          ci("integer"),
          ci("real"),
          ci("number"),
          ci("boolean"),
          ci("list"),
          ci("record"),
          ci("date"),
          ci("file"),
          ci("alias"),
          seq(ci("POSIX"), /\s+/, ci("file")),
          seq(ci("POSIX"), /\s+/, ci("path")),
          ci("class"),
          ci("constant"),
          ci("script"),
          seq(ci("Unicode"), /\s+/, ci("text")),
          seq(ci("styled"), /\s+/, ci("text")),
          ci("data"),
          ci("reference"),
          ci("anything"),
          seq(ci("list"), /\s+/, ci("of"), /\s+/, ci("text")),
          seq(ci("list"), /\s+/, ci("of"), /\s+/, ci("integer")),
          seq(ci("list"), /\s+/, ci("of"), /\s+/, ci("number"))
        )
      ),

    // ==================== SPECIAL REFERENCES ====================

    current_application: ($) => token(seq(ci("current"), /\s+/, ci("application"))),

    // `current date` — built-in expression returning the current date object.
    current_date: ($) => token(seq(ci("current"), /\s+/, ci("date"))),

    me_reference: ($) => token(ci("me")),

    it_reference: ($) => token(ci("it")),

    result_reference: ($) => token(ci("result")),

    null_value: ($) => token(ci("null")),

    // ==================== LITERALS ====================

    // String with escape sequences
    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            $.escape_sequence,
            /[^"\\]+/
          )
        ),
        '"'
      ),

    escape_sequence: ($) =>
      token.immediate(
        choice(
          "\\\\",
          '\\"',
          "\\n",
          "\\r",
          "\\t"
        )
      ),

    number: ($) => /-?\d+(\.\d+)?(E[+-]?\d+)?/,

    boolean: ($) => token(choice(ci("true"), ci("false"))),

    missing_value: ($) => token(seq(ci("missing"), /\s+/, ci("value"))),

    // ==================== IDENTIFIERS & COMMENTS ====================

    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: ($) =>
      token(
        choice(
          seq("--", /.*/),
          seq("(*", /[^*]*\*+([^)*][^*]*\*+)*/, ")"),
          seq("#!", /.*/)
        )
      ),
  },
});
