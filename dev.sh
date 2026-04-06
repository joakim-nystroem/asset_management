#!/bin/bash
trap 'kill 0' EXIT

(cd api && go run .) &
(cd frontend && npm run dev) &

wait
