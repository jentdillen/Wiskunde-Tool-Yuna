export type OperationMode =
  | "add"
  | "sub"
  | "both"
  | "mul"
  | "div"
  | "all";

export type OpSymbol = "+" | "-" | "*" | "/";

export interface Question {
  a: number;
  b: number;
  op: OpSymbol;
  /** Correct answer (integer). */
  answer: number;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickOpFromMode(mode: OperationMode): Exclude<OperationMode, "both" | "all"> {
  if (mode === "both") {
    return Math.random() < 0.5 ? "add" : "sub";
  }
  if (mode === "all") {
    const opts = ["add", "sub", "mul", "div"] as const;
    return opts[randInt(0, opts.length - 1)];
  }
  return mode;
}

/**
 * Generates a question within 1..max for operands (subtraction stays non-negative).
 */
export function generateQuestion(max: number, mode: OperationMode): Question {
  const opKind = pickOpFromMode(mode);

  if (opKind === "add") {
    const a = randInt(1, max);
    const b = randInt(1, max);
    return { a, b, op: "+", answer: a + b };
  }

  if (opKind === "sub") {
    const a = randInt(1, max);
    const b = randInt(1, a);
    return { a, b, op: "-", answer: a - b };
  }

  if (opKind === "mul") {
    const a = randInt(1, max);
    const b = randInt(1, max);
    return { a, b, op: "*", answer: a * b };
  }

  // div — integer quotient, no remainder
  const b = randInt(2, max);
  const maxQ = Math.floor(max / b);
  const q = maxQ >= 1 ? randInt(1, maxQ) : 1;
  const a = b * q;
  return { a, b, op: "/", answer: q };
}

export function formatQuestion(q: Question): string {
  return `${q.a} ${q.op} ${q.b} = ?`;
}

/** Decode `a|op|b` from help-request storage for display. */
export function formatQuestionKeyLabel(key: string): string {
  const parts = key.split("|");
  if (parts.length !== 3) return key;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  const op = parts[2] as OpSymbol;
  if (Number.isNaN(a) || Number.isNaN(b) || !["+", "-", "*", "/"].includes(op)) return key;
  return formatQuestion({ a, b, op, answer: 0 });
}
