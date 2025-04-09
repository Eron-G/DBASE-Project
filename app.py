from werkzeug.middleware.proxy_fix import ProxyFix
from flask import Flask, request, jsonify, session, render_template, redirect, url_for
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
from datetime import datetime, timedelta
from functools import wraps
import os



app = Flask(__name__, template_folder='templates', static_folder="static")
CORS(app)
app.secret_key = os.urandom(24)
app.permanent_session_lifetime = timedelta(days=1)

# Add ProxyFix AFTER creating the app
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Database connection
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),  # Uses env var or defaults to localhost
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''), 
            database=os.getenv('DB_NAME', 'FProject'),
            autocommit=True,
            connect_timeout=30,  # Higher timeout for PH networks
            pool_size=5          # Connection pooling
        )
        print("Database connection successful")
        return conn
    except mysql.connector.Error as err:
        print(f"Database connection failed: {err}")
        return None
# Add date validation in models
def validate_program_dates(start_date, end_date):
    if end_date < start_date:
        raise ValueError("End date cannot be before start date")
def ensure_no_transaction(conn):
    """Clean up any existing transaction"""
    if conn.in_transaction:
        conn.rollback()

# Decorator for admin-only routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Decorator for faculty-only routes
def faculty_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'faculty_id' not in session:
            return jsonify({'success': False, 'message': 'Faculty access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def login():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('registration.html')

@app.route('/register', methods=['POST'])
def register():
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Request must be JSON'}), 400
            
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data received'}), 400
        
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        role = data.get('role', 'faculty')

        # Validation
        if not all([first_name, last_name, email, password]):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = conn.cursor(dictionary=True)

        try:
            # Check if email exists
            cursor.execute("SELECT Email FROM Account WHERE Email = %s", (email,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': 'Email already registered'}), 400

            # Hash password
            hashed_password = generate_password_hash(password)

            # Insert account
            cursor.execute(
                """INSERT INTO Account 
                (First_Name, Last_Name, Email, Password_Hash, Role) 
                VALUES (%s, %s, %s, %s, %s)""",
                (first_name, last_name, email, hashed_password, role)
            )
            user_id = cursor.lastrowid

            # If faculty, create faculty record
            if role == 'faculty':
                faculty_name = f"{first_name} {last_name}"
                cursor.execute(
                    """INSERT INTO Faculty 
                    (Faculty_Name, Faculty_Status, User_ID) 
                    VALUES (%s, %s, %s)""",
                    (faculty_name, "Active", user_id)
                )

            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': 'Registration successful',
                'user_id': user_id
            })

        except mysql.connector.Error as err:
            conn.rollback()
            print(f"Database error: {err}")
            return jsonify({
                'success': False, 
                'message': 'Registration failed',
                'error': str(err)
            }), 500
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({
            'success': False, 
            'message': 'An unexpected error occurred',
            'error': str(e)
        }), 500
    
@app.route('/login', methods=['POST'])
def authenticate():
    try:
        # Ensure request is JSON
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Request must be JSON'}), 400
            
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data received'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            # Get user with faculty info
            cursor.execute("""
                SELECT a.*, f.Faculty_ID 
                FROM Account a
                LEFT JOIN Faculty f ON a.User_ID = f.User_ID
                WHERE a.Email = %s
            """, (email,))
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            
            # Verify password
            if not check_password_hash(user['Password_Hash'], password):
                return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            
            # Set session
            session.clear()
            session['user_id'] = user['User_ID']
            session['faculty_id'] = user.get('Faculty_ID')
            session['name'] = f"{user['First_Name']} {user['Last_Name']}"
            session['email'] = user['Email']
            session['is_admin'] = (user.get('Role', 'faculty') == 'admin')
            session.permanent = True
            
            return jsonify({
                'success': True, 
                'is_admin': session['is_admin'],
                'user_id': user['User_ID'],
                'faculty_id': user.get('Faculty_ID'),
                'name': session['name']
            })
            
        except Exception as e:
            print(f"Login error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'An error occurred during login',
                'error': str(e)
            }), 500
            
        finally:
            if 'cursor' in locals():
                cursor.close()
            if conn and conn.is_connected():
                conn.close()
                
    except Exception as e:
        print(f"Unexpected error in login route: {str(e)}")
        return jsonify({
            'success': False, 
            'message': 'An unexpected error occurred',
            'error': str(e)
        }), 500

        
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/check-admin')
def check_admin():
    return jsonify({'is_admin': session.get('is_admin', False)})

@app.route('/facultypage')
@faculty_required
def faculty_page():
    return render_template('facultypage.html')

@app.route('/admin')
@admin_required
def admin_page():
    return render_template('admin.html')

@app.route('/faculty/activities', methods=['GET'])
@faculty_required
def get_faculty_activities():
    faculty_id = session['faculty_id']
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'})
        
        cursor = conn.cursor(dictionary=True)
        
        query = """
        SELECT 
            dp.Program_ID,
            dp.Program_Type as type,
            dp.Program_Title as title,
            DATE(dp.Program_Start_Date) as date,
            DATE(dp.Program_End_Date) as endDate,
            TIME(dp.Program_Start_Time) as timeStart,
            TIME(dp.Program_End_Time) as timeEnd,
            dp.Program_Organizer as organizer,
            dp.Key_Takeaways as takeaways,
            fp.Participation_Status as status
        FROM Development_Program dp
        JOIN Faculty_Program fp ON dp.Program_ID = fp.Program_ID
        WHERE fp.Faculty_ID = %s
        ORDER BY dp.Program_Start_Date DESC
        """
        cursor.execute(query, (faculty_id,))
        activities = cursor.fetchall()
        
        # Add this debug print
        print("DEBUG - Activities data:", activities)
        
        for activity in activities:
            if isinstance(activity['timeStart'], timedelta):
                activity['timeStart'] = (datetime.min + activity['timeStart']).time().strftime('%H:%M:%S')
            if isinstance(activity['timeEnd'], timedelta):
                activity['timeEnd'] = (datetime.min + activity['timeEnd']).time().strftime('%H:%M:%S')
        
        return jsonify({
            'success': True, 
            'activities': activities,
            'count': len(activities)
        })
    
    except Exception as err:
        print(f"Database error fetching activities: {err}")
        return jsonify({'success': False, 'message': f'Error fetching activities: {err}'})
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.route('/faculty/activities', methods=['POST'])
@faculty_required
def add_faculty_activity():
    faculty_id = session['faculty_id']
    data = request.get_json()

    # Validation
    required_fields = ['title', 'type', 'startDate', 'timeStart', 'timeEnd', 'organizer', 'takeaways']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    # Use endDate if provided, otherwise use startDate
    end_date = data.get('endDate', data['startDate'])
    
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        conn.start_transaction()
        
        cursor.execute("""
            INSERT INTO Development_Program (
                Program_Type, Program_Title, 
                Program_Start_Date, Program_End_Date,
                Program_Start_Time, Program_End_Time,
                Program_Organizer, Key_Takeaways
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data['type'],
            data['title'],
            data['startDate'],
            end_date,
            data['timeStart'],
            data['timeEnd'],
            data['organizer'],
            data['takeaways']
        ))
        program_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO Faculty_Program (
                Faculty_ID, Program_ID, Participation_Status
            ) VALUES (%s, %s, %s)
        """, (faculty_id, program_id, data.get('status', 'Completed')))
        
        conn.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Activity added successfully',
            'activity': {
                'program_id': program_id,
                'title': data['title'],
                'type': data['type'],
                'date': data['startDate'],
                'endDate': end_date,
                'timeStart': data['timeStart'],
                'timeEnd': data['timeEnd'],
                'organizer': data['organizer'],
                'takeaways': data['takeaways'],
                'status': data.get('status', 'Completed')
            }
        })
    except Exception as err:
        if conn:
            conn.rollback()
        print(f"Database error adding activity: {err}")
        return jsonify({'success': False, 'message': f'Error adding activity: {err}'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@app.route('/admin/entries', methods=['GET'])
@admin_required
def get_admin_entries():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        query = """
        SELECT 
            f.Faculty_Name as facultyName,
            f.Faculty_Status as facultyStatus,
            dp.Program_ID,
            dp.Program_Type as type,
            dp.Program_Title as title,
            DATE(dp.Program_Start_Date) as date,
            DATE(dp.Program_End_Date) as endDate,
            TIME(dp.Program_Start_Time) as timeStart,
            TIME(dp.Program_End_Time) as timeEnd,
            dp.Program_Organizer as organizer,
            dp.Key_Takeaways as takeaways
        FROM Development_Program dp
        JOIN Faculty_Program fp ON dp.Program_ID = fp.Program_ID
        JOIN Faculty f ON fp.Faculty_ID = f.Faculty_ID
        WHERE f.Faculty_Status != 'Retired'  -- Exclude retired faculty
        ORDER BY dp.Program_Start_Date DESC
        """
        
        cursor.execute(query)
        entries = cursor.fetchall()
        
        for entry in entries:
            if isinstance(entry['timeStart'], timedelta):
                entry['timeStart'] = (datetime.min + entry['timeStart']).time().strftime('%H:%M:%S')
            if isinstance(entry['timeEnd'], timedelta):
                entry['timeEnd'] = (datetime.min + entry['timeEnd']).time().strftime('%H:%M:%S')
        
        return jsonify({
            'success': True, 
            'entries': entries,
            'count': len(entries)
        })
    
    except Exception as err:
        print(f"Database error fetching admin entries: {err}")
        return jsonify({'success': False, 'message': f'Error fetching entries: {err}'})
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@app.route('/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'})
        
        cursor = conn.cursor(dictionary=True)

        
        
        cursor.execute("SELECT COUNT(*) as count FROM Faculty")
        total_faculty = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM Development_Program")
        total_activities = cursor.fetchone()['count']
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM Development_Program 
            WHERE MONTH(Program_Start_Date) = %s AND YEAR(Program_Start_Date) = %s
        """, (current_month, current_year))
        this_month_activities = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM Faculty WHERE Faculty_Status = 'Active'")
        active_faculty = cursor.fetchone()['count']
    
        cursor.execute("SELECT COUNT(*) as count FROM Faculty WHERE Faculty_Status = 'Inactive'")
        inactive_faculty = cursor.fetchone()['count']
        
        return jsonify({
            'success': True,
            'stats': {
                'totalFaculty': total_faculty,
                'activeFaculty': active_faculty,
                'inactiveFaculty': inactive_faculty,
                'totalActivities': total_activities,
                'thisMonth': this_month_activities
            }
        })
    
    except Exception as err:
        print(f"Database error fetching stats: {err}")
        return jsonify({'success': False, 'message': f'Error fetching stats: {err}'})
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.route('/admin/faculty', methods=['GET'])
@admin_required
def get_all_faculty():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'})
        
        cursor = conn.cursor(dictionary=True)
        
        # Modified query - removed GROUP BY which could cause issues
        query = """
        SELECT 
            Faculty_ID,
            Faculty_Name,
            Faculty_Status,
            DATE_FORMAT(Created_At, '%Y-%m-%d') as join_date
        FROM Faculty
        ORDER BY Faculty_Name ASC
        """
        
        cursor.execute(query)
        faculty = cursor.fetchall()
        
        return jsonify({
            'success': True, 
            'faculty': faculty,
            'count': len(faculty)
        })
    
    except Exception as err:
        print(f"Database error fetching faculty: {err}")
        return jsonify({'success': False, 'message': f'Error fetching faculty: {err}'})
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

            
@app.route('/faculty/activities/<int:program_id>', methods=['PUT'])
@faculty_required
def update_activity(program_id):
    faculty_id = session['faculty_id']
    data = request.get_json()
    
    # Validation
    required_fields = ['title', 'type', 'startDate', 'timeStart', 'timeEnd', 'organizer', 'takeaways']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Verify ownership
        cursor.execute("""
            SELECT 1 FROM Faculty_Program 
            WHERE Faculty_ID = %s AND Program_ID = %s
        """, (faculty_id, program_id))
        
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Activity not found or access denied'}), 404
        
        # Update the program
        cursor.execute("""
            UPDATE Development_Program SET
                Program_Type = %s,
                Program_Title = %s,
                Program_Start_Date = %s,
                Program_End_Date = %s,
                Program_Start_Time = %s,
                Program_End_Time = %s,
                Program_Organizer = %s,
                Key_Takeaways = %s,
                Updated_At = CURRENT_TIMESTAMP
            WHERE Program_ID = %s
        """, (
            data['type'],
            data['title'],
            data['startDate'],
            data.get('endDate', data['startDate']),
            data['timeStart'],
            data['timeEnd'],
            data['organizer'],
            data['takeaways'],
            program_id
        ))
        
        # Also update the participation status if provided
        if 'status' in data:
            cursor.execute("""
                UPDATE Faculty_Program SET
                    Participation_Status = %s,
                    Updated_At = CURRENT_TIMESTAMP
                WHERE Program_ID = %s AND Faculty_ID = %s
            """, (data['status'], program_id, faculty_id))
        
        conn.commit()
        return jsonify({
            'success': True, 
            'message': 'Activity updated successfully',
            'updated_fields': list(data.keys())  # Return which fields were updated
        })
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error updating activity: {str(e)}")
        return jsonify({
            'success': False, 
            'message': 'Error updating activity',
            'error': str(e)
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@app.route('/admin/update-faculty-status', methods=['POST'])
@admin_required
def update_faculty_status():
    try:
        data = request.get_json()
        faculty_id = data.get('faculty_id')
        new_status = data.get('status')
        
        if not faculty_id or not new_status:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE Faculty SET Faculty_Status = %s WHERE Faculty_ID = %s",
            (new_status, faculty_id)
        )
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Status updated successfully'})
        
    except Exception as e:
        print(f"Error updating faculty status: {str(e)}")
        return jsonify({'success': False, 'message': 'Error updating status'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

if __name__ == "__main__":
    app.run(debug=True)


