from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://erp_user:erp_pass@localhost:5432/school_erp')
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, user_id FROM staff_instructors WHERE user_id = '37d8d548-e668-462c-ab8d-9c7c5f33e196'"))
        print('Amit Instructor:', res.fetchall())
        
        res2 = conn.execute(text("SELECT * FROM teacher_assignments WHERE instructor_id = (SELECT id FROM staff_instructors WHERE user_id = '37d8d548-e668-462c-ab8d-9c7c5f33e196')"))
        print('Amit Assignments:', len(res2.fetchall()))

if __name__ == '__main__':
    main()
