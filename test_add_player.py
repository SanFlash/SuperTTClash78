from app import app, db, migrate_schema

with app.app_context():
    db.create_all()
    migrate_schema()
    client = app.test_client()
    resp = client.post('/api/players', json={'name': 'Test', 'group_id': 'A', 'avatar_url': 'https://example.com/avatar.png'})
    print('status', resp.status_code)
    print(resp.get_data(as_text=True))
