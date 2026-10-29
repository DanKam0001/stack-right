#!/bin/sh
# Session 1: plan-lens, using the learner's written answers.
cd "$(dirname "$0")/../.." || exit 1
claude -p "Run the plan-lens skill. The learner is at work and can't answer live, so they wrote their interview answers in advance in devpost/interview-answers.md. Treat that file as the learner's answers to the interview questions. Do the setup check, then write devpost/design-brief.md from the template using the learner's words. Where a detail is still missing, use a sensible value from the design rules and mark it (default). Put any concerns you would have pushed back on under Risks and open questions. Leave status: draft (the learner approves it when back). Do not build anything." \
  --mcp-config .mcp.json --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/01-plan-lens.jsonl 2> devpost/agent-logs/01-plan-lens.err
echo "exit $?"
