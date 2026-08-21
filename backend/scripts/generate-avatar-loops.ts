/**
 * Generate placeholder avatar loop MP4s for frontend/public/avatar/
 *
 * Usage: npm run generate:avatar-loops
 *
 * Replace these with real character footage when production assets are ready.
 * File names must match clip-resolver.ts (idle, teasing, aroused, playful).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const avatarRoot = path.join(repoRoot, "frontend/public/avatar");

const DURATION = 6;
const FPS = 24;
const SIZE = "400x600";

interface ClipSpec {
  name: string;
  /** FFmpeg geq r/g/b expressions (T = time in seconds) */
  r: string;
  g: string;
  b: string;
}

interface CharacterSpec {
  id: string;
  clips: ClipSpec[];
}

const CHARACTERS: CharacterSpec[] = [
  {
    id: "twink-default",
    clips: [
      {
        name: "idle",
        r: "18+10*sin(2*PI*T/3)",
        g: "8+5*sin(2*PI*T/3+PI/5)",
        b: "38+18*sin(2*PI*T/3+PI/3)",
      },
      {
        name: "teasing",
        r: "80+35*sin(2*PI*T/2)",
        g: "15+20*sin(2*PI*T/2+PI/4)",
        b: "70+40*sin(2*PI*T/2+PI/6)",
      },
      {
        name: "aroused",
        r: "160+50*sin(2*PI*T/1.5)",
        g: "20+25*sin(2*PI*T/1.5+PI/3)",
        b: "90+45*sin(2*PI*T/1.5+PI/5)",
      },
      {
        name: "playful",
        r: "60+30*sin(2*PI*T/2.5)",
        g: "25+18*sin(2*PI*T/2.5+PI/2)",
        b: "100+35*sin(2*PI*T/2.5+PI/4)",
      },
    ],
  },
  {
    id: "female-default",
    clips: [
      {
        name: "idle",
        r: "28+12*sin(2*PI*T/3)",
        g: "10+6*sin(2*PI*T/3+PI/4)",
        b: "32+14*sin(2*PI*T/3+PI/2)",
      },
      {
        name: "teasing",
        r: "120+40*sin(2*PI*T/2)",
        g: "18+15*sin(2*PI*T/2+PI/5)",
        b: "55+30*sin(2*PI*T/2+PI/3)",
      },
      {
        name: "aroused",
        r: "200+40*sin(2*PI*T/1.5)",
        g: "30+20*sin(2*PI*T/1.5+PI/4)",
        b: "70+35*sin(2*PI*T/1.5+PI/6)",
      },
      {
        name: "playful",
        r: "90+35*sin(2*PI*T/2.5)",
        g: "22+16*sin(2*PI*T/2.5+PI/3)",
        b: "80+30*sin(2*PI*T/2.5+PI/5)",
      },
    ],
  },
];

function generateClip(outPath: string, clip: ClipSpec): void {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }

  const vf = `geq=r='${clip.r}':g='${clip.g}':b='${clip.b}'`;

  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${SIZE}:d=${DURATION}:r=${FPS}`,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-t",
      String(DURATION),
      outPath,
    ],
    { stdio: "pipe" },
  );
}

function main(): void {
  if (!ffmpegPath) {
    console.error("ffmpeg-static is not installed. Run: npm install");
    process.exit(1);
  }

  console.log("\n── Generating avatar loop MP4s ──\n");

  for (const character of CHARACTERS) {
    const dir = path.join(avatarRoot, character.id);
    fs.mkdirSync(dir, { recursive: true });

    for (const clip of character.clips) {
      const outPath = path.join(dir, `${clip.name}.mp4`);
      process.stdout.write(`  ${character.id}/${clip.name}.mp4 … `);
      generateClip(outPath, clip);
      const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`done (${sizeKb} KB)`);
    }
  }

  console.log("\n✓ Avatar loops written to frontend/public/avatar/\n");
}

main();
