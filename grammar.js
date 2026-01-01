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

  extras: ($) => [/\s/, $.comment],

  conflicts: ($) => [
    [$.record, $.list],
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
        $.command_call,
        $._expression
      ),

    // ==================== HANDLERS ====================

    // Handler definition: on/to handler_name(params) ... end [handler_name]
    handler_definition: ($) =>
      prec.right(
        seq(
          field("keyword", $.keyword_function),
          field("name", $.identifier),
          optional($.parameter_list),
          optional($.given_clause),
          repeat($._item),
          $.keyword_end,
          optional($.identifier)
        )
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
    if_block: ($) =>
      prec.right(
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

    // One-line if: if x then return y
    if_simple_statement: ($) =>
      prec.right(
        2,
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
    set_statement: ($) =>
      seq(
        $.keyword_set,
        field("variable", $._expression),
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

    // Expressions - simplified to avoid ambiguity
    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.string,
        $.number,
        $.boolean,
        $.missing_value,
        $.null_value,
        $.current_application,
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
        $.identifier
      ),

    parenthesized_expression: ($) => seq("(", repeat($._expression), ")"),

    list: ($) => seq("{", optional(seq($._expression, repeat(seq(",", $._expression)))), "}"),

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
          ci("ends with"),
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

    unary_operator: ($) => token(choice(ci("not"), "¬", "-")),

    // String concatenation
    concatenation: ($) =>
      prec.left(2, seq($._expression, "&", $._expression)),

    // ==================== OBJECT SPECIFIERS ====================

    // Object specifier: window 1 of application "Finder"
    object_specifier: ($) =>
      prec.left(
        3,
        seq(
          $.specifier_prefix,
          $._expression,
          token(ci("of")),
          $._expression
        )
      ),

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

    // Property reference: name of theFile
    property_reference: ($) =>
      prec.left(
        3,
        seq(
          $.identifier,
          token(ci("of")),
          $._expression
        )
      ),

    // Index expression: item 1, window 2, paragraph 3
    index_expression: ($) =>
      prec.left(
        4,
        seq(
          $.element_type,
          $._expression
        )
      ),

    element_type: ($) =>
      token(
        choice(
          ci("item"),
          ci("word"),
          ci("character"),
          ci("paragraph"),
          ci("text item"),
          ci("line"),
          ci("window"),
          ci("document"),
          ci("file"),
          ci("folder"),
          ci("disk"),
          ci("process"),
          ci("button"),
          ci("menu"),
          ci("menu item"),
          ci("text field"),
          ci("row"),
          ci("column"),
          ci("cell")
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
