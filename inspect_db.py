import sqlite3
import os

db_path = 'instance/tournament.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    for table in ['player', 'match', 'standing']:
        print(f"Schema for {table}:")
        cursor.execute(f"PRAGMA table_info({table})")
        cols = cursor.fetchall()
        for col in cols:
            print(col)
        print("-" * 20)
    conn.close()
else:
    print("Database not found")
