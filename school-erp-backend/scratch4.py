from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql+psycopg2://erp_user:erp_pass@localhost:5432/school_erp')
    with engine.connect() as conn:
        res = conn.execute(text("SELECT email, id FROM users WHERE email LIKE '%amit%';"))
        print('Users:', res.fetchall())
        res2 = conn.execute(text("SELECT id, instructor_id, section_id FROM teacher_assignments;"))
        print('Assignments:', res2.fetchall())

if __name__ == '__main__':
    main()
