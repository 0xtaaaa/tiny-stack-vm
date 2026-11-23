// make.fun's tiny stack ISA v1, rule for rule with the reference VM (generator/subject/vm.mjs): every trap keeps the
// output written before it, the trapping instruction writes nothing, and limits are checked before their effect.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STACK = 256, CALLS = 64, WORDS = 256, STEPS = 1_000_000, OUT_MAX = 65_536;

// Per opcode byte: [immediate bytes, values popped, values pushed + 1]. A 0 third entry is an unknown opcode.
const META = new Uint8Array(256 * 3);
for (const [lo, hi, im, po, pu] of [
  [0x00, 0x00, 0, 0, 0], [0x01, 0x01, 1, 0, 1], [0x02, 0x02, 4, 0, 1], [0x03, 0x03, 0, 1, 0],
  [0x04, 0x04, 0, 1, 2], [0x05, 0x05, 0, 2, 2], [0x06, 0x06, 0, 2, 3], [0x07, 0x07, 0, 3, 3],
  [0x10, 0x16, 0, 2, 1], [0x17, 0x17, 0, 1, 1], [0x18, 0x1a, 0, 2, 1], [0x1b, 0x1b, 0, 1, 1],
  [0x1c, 0x1e, 0, 2, 1], [0x20, 0x22, 0, 2, 1],
  [0x30, 0x30, 2, 0, 0], [0x31, 0x32, 2, 1, 0], [0x33, 0x33, 2, 0, 0], [0x34, 0x34, 0, 0, 0],
  [0x40, 0x40, 0, 1, 1], [0x41, 0x41, 0, 2, 0],
  [0x50, 0x51, 0, 1, 0], [0x52, 0x52, 0, 0, 1], [0x53, 0x53, 0, 1, 0],
]) for (let o = lo; o <= hi; o++) META.set([im, po, pu + 1], o * 3);

/** One program to its end: the bytes it wrote and the exit code it ended with (a trap's code included). */
function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length;
  const D = new Int32Array(STACK), C = new Int32Array(CALLS), M = new Int32Array(WORDS), O = new Uint8Array(OUT_MAX);
  let sp = 0, csp = 0, ol = 0, ip = 0, pc = 0, steps = 0;
  const end = (code: number) => ({ out: O.subarray(0, ol), code });
  for (;;) {
    if (steps === STEPS) return end(10); // step limit
    if (pc < 0 || pc >= n) return end(9); // pc outside the program
    const op = p[pc], m = op * 3, pu1 = META[m + 2];
    if (pu1 === 0) return end(5); // unknown opcode
    const im = META[m], pops = META[m + 1], pushes = pu1 - 1;
    if (pc + im >= n) return end(9); // immediate cut off by the end
    steps++;
    const next = pc + 1 + im;
    if (sp < pops) return end(2); // stack underflow
    if (sp - pops + pushes > STACK) return end(3); // stack overflow
    pc = next;
    switch (op) {
      case 0x00: return end(0); // HALT
      case 0x01: D[sp++] = (p[next - 1] << 24) >> 24; break; // PUSH8, sign extended
      case 0x02: D[sp++] = p[next - 4] | (p[next - 3] << 8) | (p[next - 2] << 16) | (p[next - 1] << 24); break;
      case 0x03: sp--; break; // POP
      case 0x04: D[sp] = D[sp - 1]; sp++; break; // DUP
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; } // SWAP
      case 0x06: D[sp] = D[sp - 2]; sp++; break; // OVER
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; } // ROT
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break; // NEG
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break; // NOT
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[next - 2] | (p[next - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (!take) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = next + rel; // the target is checked at the next step
        break;
      }
      case 0x33:
        if (csp === CALLS) return end(7); // call depth
        C[csp++] = next;
        pc = p[next - 2] | (p[next - 1] << 8); // an unsigned address
        break;
      case 0x34:
        if (csp === 0) return end(8); // RET with an empty call stack
        pc = C[--csp];
        break;
      case 0x40: {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= WORDS) return end(6);
        D[sp - 1] = M[addr];
        break;
      }
      case 0x41: {
        const addr = D[sp - 1], v = D[sp - 2];
        if (addr < 0 || addr >= WORDS) return end(6);
        sp -= 2;
        M[addr] = v;
        break;
      }
      case 0x50: {
        const s = String(D[sp - 1]); // decimal ASCII, a leading '-' when negative
        if (ol + s.length > OUT_MAX) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) O[ol++] = s.charCodeAt(i);
        break;
      }
      case 0x51:
        if (ol + 1 > OUT_MAX) return end(11);
        O[ol++] = D[--sp] & 255;
        break;
      case 0x52: D[sp++] = ip < inp.length ? inp[ip++] : -1; break; // IN: -1 once used up
      case 0x53: return end(D[--sp] & 255); // EXIT: the low byte
      default: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        switch (op) {
          case 0x10: r = (a + b) | 0; break;
          case 0x11: r = (a - b) | 0; break;
          case 0x12: r = Math.imul(a, b); break;
          case 0x13:
            if (b === 0) return end(4);
            r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
            break;
          case 0x14:
            if (b === 0) return end(4);
            r = b === -1 ? 0 : (a % b) | 0;
            break;
          case 0x15:
            if (b === 0) return end(4);
            r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
            break;
          case 0x16:
            if (b === 0) return end(4);
            r = ((a >>> 0) % (b >>> 0)) | 0;
            break;
          case 0x18: r = a & b; break;
          case 0x19: r = a | b; break;
          case 0x1a: r = a ^ b; break;
          case 0x1c: r = a << (b & 31); break;
          case 0x1d: r = a >> (b & 31); break;
          case 0x1e: r = (a >>> (b & 31)) | 0; break;
          case 0x20: r = a === b ? 1 : 0; break;
          case 0x21: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break; // LTU
        }
        sp -= 2;
        D[sp++] = r;
      }
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const read = (path: string): Uint8Array => { try { return readFileSync(path); } catch { return new Uint8Array(0); } };
for (const id of readdirSync(I).sort()) {
  const { out, code } = run(read(join(I, id, 'program.bin')), read(join(I, id, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), out);
  writeFileSync(join(OUT, id, 'exit.txt'), String(code));
}
