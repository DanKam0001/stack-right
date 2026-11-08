"""Cut the demo video from the scripted preview recording + narration.

Inputs (this folder): raw_demo.mp4, record_start.txt, demo_beats.log ("HH:MM:SS.mmm [DEMO] <beat>"),
narration.json and vo/<line>.mp3. Output: stack_right_demo.mp4 (1920x1080, 30 fps) + captions.srt.
Every cut point is a [DEMO] beat, so a re-recorded take re-cuts without editing this file.
Run:  python cut.py [raw.mp4 beats.log record_start.txt]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

FF = "C:/ffmpeg/bin/ffmpeg.exe"
HERE = Path(__file__).resolve().parent
WORK = HERE / "_cut"
FONT = "C\\:/Windows/Fonts/segoeuib.ttf"

raw, beats_log, start_txt = (sys.argv[1:4] if len(sys.argv) > 3 else ("raw_demo.mp4", "demo_beats.log", "record_start.txt"))
RAW = HERE / raw


def secs(hms: str) -> float:
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


t0 = secs((HERE / start_txt).read_text().strip().split()[-1])
B = {}
for line in (HERE / beats_log).read_text(encoding="utf-8").splitlines():
    m = re.search(r"(\d\d:\d\d:\d\d\.\d+)\s+\[DEMO\] (\w+)\s*$", line)
    if m and m.group(2) not in B:
        B[m.group(2)] = secs(m.group(1)) - t0
need = ["intro", "case1", "overhang", "gap", "case2", "layer1", "layer2", "layer3mixed", "fast", "layer5", "complete", "reset", "end"]
TESTS = "Tested: 76 self-test checks, 7 LEAF scenarios"
missing = [b for b in need if b not in B]
if missing:
    raise SystemExit(f"beats missing from {beats_log}: {missing}")

VO = dict(json.loads((HERE / "narration.json").read_text(encoding="utf-8")))


def run(args):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def dur(p: Path) -> float:
    out = subprocess.run([FF, "-i", str(p)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


# Source frame is 1476x830. Crops are (x, y, w, h), all 16:9.
WIDE = (150, 0, 1176, 662)
FULL = (0, 0, 1476, 830)
GHOST = (330, 300, 640, 360)       # ghost + tag + pallet front at layer 1
TIP = (300, 260, 800, 450)         # pallet + red tip
CARD = (250, 0, 976, 549)          # completion card + top of stack


def vf(speed=1.0, crop=WIDE):
    x, y, w, h = crop
    return f"setpts=PTS/{speed},crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,fps=30,format=yuv420p"


def part(out: Path, a: float, b: float, speed=1.0, crop=WIDE):
    run(["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(RAW), "-vf", vf(speed, crop), "-an",
         "-c:v", "libx264", "-crf", "18", "-preset", "medium", str(out)])


def still(out: Path, t: float, seconds: float, crop=WIDE, zoom=0.0, dim=False):
    png = out.with_suffix(".png")
    run(["-ss", f"{t:.3f}", "-i", str(RAW), "-frames:v", "1", str(png)])
    x, y, w, h = crop
    n = int(seconds * 30)
    f = f"crop={w}:{h}:{x}:{y},scale=3840:2160,zoompan=z='1+{zoom}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1920x1080:fps=30"
    if dim:
        f += ",boxblur=12:2,eq=brightness=-0.18"
    run(["-i", str(png), "-vf", f + ",format=yuv420p", "-frames:v", str(n), "-c:v", "libx264", "-crf", "18", str(out)])


def label_filters(labels, w=1920):
    fs = []
    for i, (text, a, b, where) in enumerate(labels):
        tf = WORK / f"label_{abs(hash((text, a)))}.txt"
        tf.write_text(text, encoding="utf-8")
        tfp = str(tf).replace("\\", "/").replace(":", "\\:")
        if where == "title":
            pos, size = "x=(w-text_w)/2:y=h*0.36", 96
        elif where == "sub":
            pos, size = "x=(w-text_w)/2:y=h*0.36+130", 44
        elif where == "bl":
            pos, size = "x=64:y=h-320", 46
        else:  # top-left lower-third style label
            pos, size = "x=64:y=56", 46
        fs.append(f"drawtext=fontfile='{FONT}':textfile='{tfp}':fontsize={size}:fontcolor=white:"
                  f"box=1:boxcolor=0x1b2a3a@0.72:boxborderw=22:{pos}:enable='between(t,{a},{b})'")
    return fs


def segment(name: str, parts: list, vo: str | None, vo_at=0.3, tail=0.7, labels=()):
    """parts: list of callables(out_path) building video pieces; the last frame is held until the line ends."""
    files = []
    for i, build in enumerate(parts):
        p = WORK / f"{name}_{i}.mp4"
        build(p)
        files.append(p)
    lst = WORK / f"{name}.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in files), encoding="utf-8")
    vlen = sum(dur(p) for p in files)
    alen = dur(HERE / "vo" / f"{vo}.mp3") if vo else 0.0
    L = max(vlen, vo_at + alen + tail) if vo else vlen
    vchain = ",".join(["tpad=stop_mode=clone:stop_duration=60", f"trim=duration={L:.3f}", "setpts=PTS-STARTPTS",
                       *label_filters(labels)])
    out = WORK / f"seg_{name}.mp4"
    args = ["-f", "concat", "-safe", "0", "-i", str(lst)]
    if vo:
        args += ["-i", str(HERE / "vo" / f"{vo}.mp3")]
        fc = (f"[0:v]{vchain}[v];[1:a]aresample=48000,adelay=delays={int(vo_at * 1000)}:all=1,apad,"
              f"atrim=duration={L:.3f},aformat=channel_layouts=stereo[a]")
    else:
        args += ["-f", "lavfi", "-t", f"{L:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        fc = f"[0:v]{vchain}[v];[1:a]atrim=duration={L:.3f}[a]"
    run([*args, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", str(out)])
    return out, L, (vo, vo_at)


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def chunks(text: str):
    """Sentences, with long ones split at a comma so a caption stays on one or two short lines."""
    out = []
    for s in re.split(r"(?<=[.?!])\s+", text.strip()):
        if len(s) > 70 and "," in s:
            i = s.index(",", len(s) // 3) if "," in s[len(s) // 3:] else s.index(",")
            out += [s[: i + 1], s[i + 1:].strip()]
        else:
            out.append(s)
    return [c for c in out if c]


def main():
    WORK.mkdir(exist_ok=True)
    b = B
    segs = [
        segment("intro", [lambda p: still(p, b["intro"] + 1.0, 4.0, WIDE, zoom=0.12)], "intro", vo_at=1.2,
                labels=[("Stack Right", 0.0, 4.6, "title"), ("A pallet-building trainer for Specs", 0.0, 4.6, "sub")]),
        segment("case1", [lambda p: part(p, b["case1"], b["case1"] + 3.0, 0.6, WIDE),
                          lambda p: part(p, b["case1"] + 3.0, b["overhang"], 0.6, GHOST)], "case1", vo_at=0.2),
        segment("overhang", [lambda p: part(p, b["overhang"], b["gap"], 1.0, TIP)], "overhang", vo_at=1.6, tail=0.2,
                labels=[("Rule 1: no overhang", 2.4, 6.0, "tl")]),
        segment("gap", [lambda p: part(p, b["gap"], b["case2"], 1.0, TIP)], "gap", vo_at=1.6, tail=0.2,
                labels=[("Rule 2: no gaps", 2.4, 6.0, "tl")]),
        segment("layer1", [lambda p: part(p, b["case2"], b["layer2"], 1.0, WIDE)], "layer1", vo_at=0.6),
        segment("layer2", [lambda p: part(p, b["layer2"], b["layer3mixed"], 1.0, WIDE)], "layer2", vo_at=0.3),
        segment("layer3mixed", [lambda p: part(p, b["layer3mixed"], b["fast"], 1.0, WIDE)], "layer3mixed", vo_at=0.3,
                labels=[("Rule 3: big cases first, small ones fill the strip", 0.5, 7.5, "tl"),
                        ("Rule 4: turn the layer so joints cross", 7.5, 13.0, "tl")]),
        segment("built", [lambda p: part(p, b["fast"], b["complete"], 0.8, WIDE)], "built", vo_at=0.3,
                labels=[("Brief: CLAD plan-lens, corrected by a real picker", 3.0, 10.5, "tl"),
                        ("Built: CLAD + Lens Studio MCP", 10.5, 15.0, "tl"),
                        (TESTS, 15.0, 21.0, "tl")]),
        segment("complete", [lambda p: part(p, b["complete"], b["reset"], 1.0, CARD)], "complete", vo_at=0.6,
                labels=[("Scored: time + mistakes by rule", 0.6, 7.5, "bl")]),
        segment("close", [lambda p: still(p, b["complete"] + 4.0, 3.0, FULL, zoom=0.0, dim=True)], "close", vo_at=0.4, tail=1.2,
                labels=[("Stack Right", 0.0, 99, "title"), ("Built with CLAD + the Lens Studio MCP", 0.0, 99, "sub")]),
    ]

    # captions: each line's sentences spread over its audio by character count
    srt, t, n = [], 0.0, 1
    for out, L, (vo, at) in segs:
        if vo:
            parts = chunks(VO[vo])
            total = sum(len(c) for c in parts)
            a = dur(HERE / "vo" / f"{vo}.mp3")
            s = t + at
            for c in parts:
                e = s + a * len(c) / total
                srt.append(f"{n}\n{srt_time(s)} --> {srt_time(e - 0.05)}\n{c}\n")
                n, s = n + 1, e
        t += L
    (WORK / "captions.srt").write_text("\n".join(srt), encoding="utf-8")
    (HERE / "captions.srt").write_text("\n".join(srt), encoding="utf-8")

    lst = WORK / "all.txt"
    lst.write_text("".join(f"file '{o.as_posix()}'\n" for o, _, _ in segs), encoding="utf-8")
    style = "Fontname=Segoe UI Semibold,Fontsize=17,PrimaryColour=&H00FFFFFF,BackColour=&H90000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=26"
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "all.txt",
                    "-vf", f"subtitles=captions.srt:force_style='{style}'",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:v", "libx264", "-crf", "19", "-preset", "slow",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(HERE / "stack_right_demo.mp4")],
                   check=True, cwd=WORK)
    final = HERE / "stack_right_demo.mp4"
    print(f"wrote {final}  {dur(final):.1f}s")
    for out, L, (vo, at) in segs:
        print(f"  {out.stem:16} {L:5.1f}s")


if __name__ == "__main__":
    main()
