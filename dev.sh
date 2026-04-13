#!/bin/bash
trap 'kill 0' EXIT

(cd ws && go run .) &
(cd frontend && npm run dev) &

wait
