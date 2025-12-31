/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Minimal AppleScript grammar for syntax highlighting
// AppleScript's English-like syntax is inherently ambiguous for LR parsing,
// so this grammar focuses on token recognition rather than full parsing.

module.exports = grammar({
  name: "applescript",

  extras: ($) => [/\s/],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) => choice(
      $.comment,
      $.string,
      $.number,
      $.keyword,
      $.operator,
      $.punctuation,
      $.identifier
    ),

    comment: ($) => token(choice(
      seq("--", /.*/),
      seq("(*", /[^*]*\*+([^)*][^*]*\*+)*/, ")"),
      seq("#!", /.*/)
    )),

    string: ($) => /"[^"]*"/,

    number: ($) => /\d+(\.\d+)?/,

    keyword: ($) => token(choice(
      // Block keywords
      /[oO][nN]/,
      /[tT][oO]/,
      /[eE][nN][dD]/,
      /[tT][eE][lL][lL]/,
      /[iI][fF]/,
      /[tT][hH][eE][nN]/,
      /[eE][lL][sS][eE]/,
      /[rR][eE][pP][eE][aA][tT]/,
      /[tT][rR][yY]/,
      /[eE][rR][rR][oO][rR]/,

      // Statement keywords
      /[sS][eE][tT]/,
      /[rR][eE][tT][uU][rR][nN]/,
      /[eE][xX][iI][tT]/,
      /[pP][rR][oO][pP][eE][rR][tT][yY]/,
      /[gG][lL][oO][bB][aA][lL]/,
      /[lL][oO][cC][aA][lL]/,
      /[uU][sS][eE]/,

      // Control flow
      /[wW][hH][iI][lL][eE]/,
      /[uU][nN][tT][iI][lL]/,
      /[fF][rR][oO][mM]/,
      /[wW][iI][tT][hH]/,
      /[tT][iI][mM][eE][sS]/,
      /[bB][yY]/,
      /[iI][nN]/,

      // Text attributes
      /[cC][oO][nN][sS][iI][dD][eE][rR][iI][nN][gG]/,
      /[iI][gG][nN][oO][rR][iI][nN][gG]/,
      /[cC][aA][sS][eE]/,

      // Special objects
      /[aA][pP][pP][lL][iI][cC][aA][tT][iI][oO][nN]/,
      /[sS][cC][rR][iI][pP][tT]/,
      /[fF][rR][aA][mM][eE][wW][oO][rR][kK]/,

      // Built-in values
      /[tT][rR][uU][eE]/,
      /[fF][aA][lL][sS][eE]/,
      /[iI][tT]/,
      /[mM][eE]/,
      /[rR][eE][sS][uU][lL][tT]/,
      /[mM][iI][sS][sS][iI][nN][gG]/,
      /[vV][aA][lL][uU][eE]/,

      // Operators as keywords
      /[aA][nN][dD]/,
      /[oO][rR]/,
      /[nN][oO][tT]/,
      /[iI][sS]/,
      /[oO][fF]/,
      /[cC][oO][nN][tT][aA][iI][nN][sS]/,
      /[mM][oO][dD]/,
      /[dD][iI][vV]/,

      // Misc
      /[vV][eE][rR][sS][iI][oO][nN]/,
      /[sS][cC][rR][iI][pP][tT][iI][nN][gG]/,
      /[aA][dD][dD][iI][tT][iI][oO][nN][sS]/,
      /[aA][pP][pP][lL][eE][sS][cC][rR][iI][pP][tT]/
    )),

    operator: ($) => token(choice(
      "=", "≠", "/=", "<", ">", "≤", "<=", "≥", ">=",
      "+", "-", "*", "/", "^", "&", "¬"
    )),

    punctuation: ($) => token(choice(
      "(", ")", "{", "}", "[", "]", ",", ":", "'"
    )),

    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
  },
});
