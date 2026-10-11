#!/usr/bin/env python3
"""Eklenti kökünden çalıştırılır: python3 arac.py <komut> ... (yardım: -h)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from soz.cli import main  # noqa: E402

main()
