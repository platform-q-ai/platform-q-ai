#!/usr/bin/env bash
set -o errexit

mix deps.get
mix alkali.build
