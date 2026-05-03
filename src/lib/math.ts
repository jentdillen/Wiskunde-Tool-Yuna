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
 * Genereert een vraag passend bij missie-instelling `max` (getallen tot en met max).
 * - Optelling: beide termen ≥ 1 en som ≤ max (dus echt “tot 10”, niet 10+10).
 * - Aftrekking: niet-negatief, termen binnen 1..max.
 * - Vermenigvuldiging: beide factoren 1..max (product kan groter zijn dan max; tafels tot 10).
 * - Deling: geheel quotiënt, deeltal en deler passend bij max.
 */
export function generateQuestion(max: number, mode: OperationMode): Question {
  const opKind = pickOpFromMode(mode);

  if (opKind === "add") {
    const sum = randInt(2, max);
    const a = randInt(1, sum - 1);
    const b = sum - a;
    return { a, b, op: "+", answer: sum };
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

/** Zelfde sleutel als in oefenen/help (`a|b|op`). */
export function questionDedupeKey(q: Pick<Question, "a" | "b" | "op">): string {
  return `${q.a}|${q.b}|${q.op}`;
}

function enumerateAdd(max: number): Question[] {
  const out: Question[] = [];
  for (let sum = 2; sum <= max; sum++) {
    for (let a = 1; a <= sum - 1; a++) {
      const b = sum - a;
      out.push({ a, b, op: "+", answer: sum });
    }
  }
  return out;
}

function enumerateSub(max: number): Question[] {
  const out: Question[] = [];
  for (let a = 1; a <= max; a++) {
    for (let b = 1; b <= a; b++) {
      out.push({ a, b, op: "-", answer: a - b });
    }
  }
  return out;
}

function enumerateMul(max: number): Question[] {
  const out: Question[] = [];
  for (let a = 1; a <= max; a++) {
    for (let b = 1; b <= max; b++) {
      out.push({ a, b, op: "*", answer: a * b });
    }
  }
  return out;
}

function enumerateDiv(max: number): Question[] {
  const out: Question[] = [];
  for (let b = 2; b <= max; b++) {
    const maxQ = Math.floor(max / b);
    for (let q = 1; q <= maxQ; q++) {
      const a = b * q;
      out.push({ a, b, op: "/", answer: q });
    }
  }
  return out;
}

/** Alle geldige vragen voor deze missie (zelfde regels als generateQuestion). */
export function enumerateMissionQuestions(max: number, mode: OperationMode): Question[] {
  switch (mode) {
    case "add":
      return enumerateAdd(max);
    case "sub":
      return enumerateSub(max);
    case "mul":
      return enumerateMul(max);
    case "div":
      return enumerateDiv(max);
    case "both":
      return [...enumerateAdd(max), ...enumerateSub(max)];
    case "all":
      return [...enumerateAdd(max), ...enumerateSub(max), ...enumerateMul(max), ...enumerateDiv(max)];
    default:
      return enumerateAdd(max);
  }
}

/**
 * Kiest een vraag die nog niet in `used` zit. Als alles gebruikt is (zeldzaam), wordt uit het volledige reservoir gekozen.
 */
export function generateQuestionUnique(max: number, mode: OperationMode, used: ReadonlySet<string>): Question {
  const all = enumerateMissionQuestions(max, mode);
  if (all.length === 0) {
    return generateQuestion(max, mode);
  }
  const unused = all.filter((q) => !used.has(questionDedupeKey(q)));
  const pool = unused.length > 0 ? unused : all;
  return pool[randInt(0, pool.length - 1)];
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
