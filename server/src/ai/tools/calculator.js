/**
 * Safe mathematical calculator without using eval() or Function().
 * Uses a recursive descent parser for safe arithmetic and math functions.
 */

function safeEvaluate(expr) {
  if (!expr || typeof expr !== 'string') {
    throw new Error('Expression must be a non-empty string');
  }

  // Handle percentages like "15% of 340" -> 0.15 * 340
  let clean = expr
    .replace(/(\d+(\.\d+)?)%\s*(?:of)?\s*(\d+(\.\d+)?)/gi, '($1/100)*$3')
    .replace(/(\d+(\.\d+)?)%/g, '($1/100)')
    .replace(/\^/g, '**');

  // Tokenize
  const tokens = [];
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(clean[i + 1]))) {
      let numStr = '';
      while (i < clean.length && (/[\d.]/.test(clean[i]))) {
        numStr += clean[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < clean.length && /[a-zA-Z0-9_]/.test(clean[i])) {
        ident += clean[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident.toLowerCase() });
      continue;
    }

    if (ch === '*' && clean[i + 1] === '*') {
      tokens.push({ type: 'OP', value: '**' });
      i += 2;
      continue;
    }

    if ('+-*/%()'.includes(ch)) {
      tokens.push({ type: ch === '(' || ch === ')' ? ch : 'OP', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character in calculation: "${ch}"`);
  }

  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  function parseExpression() {
    return parseAddSub();
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parsePower();
    while (peek() && peek().type === 'OP' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = consume().value;
      const right = parsePower();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero error');
        left = left / right;
      }
      else if (op === '%') left = left % right;
    }
    return left;
  }

  function parsePower() {
    let left = parseUnary();
    if (peek() && peek().type === 'OP' && peek().value === '**') {
      consume();
      const right = parsePower(); // right-associative
      left = Math.pow(left, right);
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const val = parseUnary();
      return op === '-' ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'NUMBER') {
      consume();
      return token.value;
    }

    if (token.type === '(') {
      consume();
      const exprVal = parseExpression();
      if (!peek() || peek().type !== ')') throw new Error('Mismatched parentheses');
      consume();
      return exprVal;
    }

    if (token.type === 'IDENT') {
      const fn = consume().value;
      if (fn === 'pi') return Math.PI;
      if (fn === 'e') return Math.E;

      if (!peek() || peek().type !== '(') {
        throw new Error(`Unknown identifier: ${fn}`);
      }
      consume(); // '('
      const arg = parseExpression();
      if (!peek() || peek().type !== ')') throw new Error('Missing closing parenthesis for function');
      consume(); // ')'

      switch (fn) {
        case 'sqrt': return Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        case 'round': return Math.round(arg);
        case 'floor': return Math.floor(arg);
        case 'ceil': return Math.ceil(arg);
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'log': return Math.log(arg);
        case 'log10': return Math.log10(arg);
        default: throw new Error(`Unsupported function: ${fn}`);
      }
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unparsed extra characters near: ${JSON.stringify(tokens[pos])}`);
  }
  return Number.isFinite(result) ? result : NaN;
}

const calculatorTool = {
  name: 'calculator',
  description: 'Safely evaluate mathematical calculations, arithmetic, compound interest, percentages, and scientific formulas.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The math expression to compute, e.g. "15% of 340", "sqrt(144) + 10^2", "(5000 * (1 + 0.07)^5)"'
      }
    },
    required: ['expression']
  },
  execute: async ({ expression }) => {
    try {
      const result = safeEvaluate(expression);
      return {
        expression,
        result,
        formatted: typeof result === 'number' ? result.toLocaleString('en-US', { maximumFractionDigits: 6 }) : String(result)
      };
    } catch (err) {
      return {
        expression,
        error: err.message
      };
    }
  }
};

module.exports = {
  calculatorTool,
  safeEvaluate
};
