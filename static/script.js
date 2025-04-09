// Utility Functions
function redirectToLogin() {
    window.location.href = '/';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        setTimeout(() => errorElement.textContent = '', 3000);
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatTime(timeStr) {
    if (!timeStr) return 'N/A';
    return timeStr.substring(0, 5);
}

function formatTimeRange(start, end) {
    if (!start || !end) return 'N/A';
    return `${formatTime(start)} - ${formatTime(end)}`;
}

function setLoadingState(loading) {
    const submitBtn = document.querySelector('#activityForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = loading;
        submitBtn.innerHTML = loading ? 
            '<span class="loading-spinner"></span> Submitting...' : 
            'Submit Activity';
    }
}

// Login Page Script
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    console.log('Login attempt:', { email, password });
    
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            email: email.toLowerCase().trim(), 
            password: password 
        }),
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.message || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Login successful, redirecting...', data);
            window.location.href = data.is_admin ? '/admin' : '/facultypage';
        } else {
            throw new Error(data.message || 'Login failed');
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = error.message || 'An error occurred. Please try again.';
        }
    });
});

// Registration Page Script
if (document.getElementById('registrationForm')) {
    const registrationForm = document.getElementById('registrationForm');
    
    registrationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = '';
        
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            role: document.querySelector('input[name="role"]:checked').value
        };

        // Client-side validation
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
            showError('error-message', 'All fields are required');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            showError('error-message', 'Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            showError('error-message', 'Password must be at least 6 characters');
            return;
        }

        const submitBtn = document.querySelector('#registrationForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';

        // Remove confirmPassword before sending to server
        const { confirmPassword, ...dataToSend } = formData;

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend)
        })
        .then(async response => {
            const contentType = response.headers.get('content-type');
            
            // Handle JSON response
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }
                return data;
            }
            
            // Handle non-JSON response
            const text = await response.text();
            throw new Error(text || 'Registration failed');
        })
        .then(data => {
            if (data.success) {
                alert('Registration successful! Please login.');
                window.location.href = '/';
            } else {
                throw new Error(data.message || 'Registration failed');
            }
        })
        .catch(error => {
            console.error("Registration error:", error);
            showError('error-message', error.message || 'An error occurred. Please try again.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        });
    });
}

// Faculty Page Script
if (document.getElementById('faculty-page')) {
    console.log('Faculty page script loaded');

    // Check if user is admin and show navigation buttons
    fetch('/check-admin')
        .then(response => response.json())
        .then(data => {
            if (data.is_admin) {
                const adminBtn = document.getElementById('adminPageBtn');
                if (adminBtn) {
                    adminBtn.style.display = 'inline-block';
                    adminBtn.addEventListener('click', function() {
                        window.location.href = '/admin';
                    });
                }
            }
        })
        .catch(error => console.error('Error checking admin status:', error));
    
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                }
            })
            .catch(error => console.error('Logout error:', error));
        });
    }

    // Form submission for new activity
    document.getElementById('activityForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const activityData = {
            title: document.getElementById('activityTitle').value,
            type: document.getElementById('programType').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value || document.getElementById('startDate').value,
            timeStart: document.getElementById('startTime').value,
            timeEnd: document.getElementById('endTime').value,
            organizer: document.getElementById('organizer').value,
            takeaways: document.getElementById('keyTakeaways').value,
            status: 'Completed'
        };
    
        // Validate required fields
        if (!activityData.title || !activityData.type || !activityData.startDate || 
            !activityData.timeStart || !activityData.timeEnd || !activityData.organizer) {
            alert('Please fill in all required fields');
            return;
        }
    
        fetch('/faculty/activities', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(activityData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Failed to add activity');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                addActivityToTable(data.activity);
                document.getElementById('activityForm').reset();
                alert('Activity added successfully!');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        });
    });
    
    function renderActivities(activities) {
        const tableBody = document.getElementById('activitiesTableBody');
        tableBody.innerHTML = '';
        
        activities.forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${activity.title || 'N/A'}</td>
                <td>${activity.type || 'N/A'}</td>
                <td>${formatDate(activity.date) || 'N/A'}</td>
                <td>${formatDate(activity.endDate || activity.date) || 'N/A'}</td>
                <td>${formatTimeRange(activity.timeStart, activity.timeEnd)}</td>
                <td>${activity.organizer || 'N/A'}</td>
                <td>${activity.takeaways || 'No takeaways provided'}</td>
                <td class="actions-cell">
                    <button class="btn-edit" data-program-id="${activity.Program_ID}">Edit</button>
                    <button class="btn-delete" data-program-id="${activity.Program_ID}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
            
            // Add event listeners to the new buttons
            row.querySelector('.btn-edit').addEventListener('click', handleEditActivity);
            row.querySelector('.btn-delete').addEventListener('click', handleDeleteActivity);
        });
    }

    function openEditModal(programId, currentData) {
        const modal = document.getElementById('editModal');
        modal.style.display = 'block';
        
        // Fill form with current data
        document.getElementById('editProgramId').value = programId;
        document.getElementById('editActivityTitle').value = currentData.title;
        document.getElementById('editProgramType').value = currentData.type;
        document.getElementById('editStartDate').value = formatDateForInput(currentData.date);
        document.getElementById('editEndDate').value = formatDateForInput(currentData.endDate);
        document.getElementById('editOrganizer').value = currentData.organizer;
        document.getElementById('editKeyTakeaways').value = currentData.takeaways;
        
        // Parse time range (assuming format "HH:MM - HH:MM")
        if (currentData.time) {
            const [startTime, endTime] = currentData.time.split(' - ');
            document.getElementById('editStartTime').value = startTime.trim();
            document.getElementById('editEndTime').value = endTime.trim();
        }
        
        // Close modal when clicking X
        document.querySelector('.close-modal').onclick = function() {
            modal.style.display = 'none';
        };
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    function handleDeleteActivity(e) {
        if (!confirm('Are you sure you want to delete this activity?')) {
            return;
        }
        
        const programId = e.target.dataset.programId;
        
        fetch(`/faculty/activities/${programId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Failed to delete activity');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                e.target.closest('tr').remove();
                showMessage('Activity deleted successfully');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('Error: ' + error.message, true);
        });
    }
    
    function formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    }
    
    // Handle edit form submission
   // Handle edit form submission
   document.getElementById('editActivityForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const programId = document.getElementById('editProgramId').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value || startDate;
    
    const updatedData = {
        title: document.getElementById('editActivityTitle').value,
        type: document.getElementById('editProgramType').value,
        startDate: startDate,
        endDate: endDate,
        timeStart: document.getElementById('editStartTime').value,
        timeEnd: document.getElementById('editEndTime').value,
        organizer: document.getElementById('editOrganizer').value,
        takeaways: document.getElementById('editKeyTakeaways').value
    };
    
    // Add loading state
    const saveBtn = document.querySelector('#editActivityForm button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
    
    fetch(`/faculty/activities/${programId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || 'Failed to update activity');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Close modal
            document.getElementById('editModal').style.display = 'none';
            
            // Refresh the activity table
            loadFacultyActivities();
            
            // Show success message
            showMessage('Activity updated successfully');
        } else {
            throw new Error(data.message || 'Update failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, true);
    })
    .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    });
});


    // Update your handleEditActivity function
    function handleEditActivity(e) {
        const programId = e.target.dataset.programId;
        const row = e.target.closest('tr');
        
        // Get current values from the table row
        const currentData = {
            title: row.cells[0].textContent,
            type: row.cells[1].textContent,
            date: row.cells[2].textContent,
            endDate: row.cells[3].textContent,
            time: row.cells[4].textContent,
            organizer: row.cells[5].textContent,
            takeaways: row.cells[6].textContent
        };
        
        openEditModal(programId, currentData);
    }

    
    function addActivityToTable(activity) {
        const tableBody = document.getElementById('activitiesTableBody');
        
        if (tableBody.querySelector('.empty-message')) {
            tableBody.innerHTML = '';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${activity.title || 'N/A'}</td>
            <td>${activity.type || 'N/A'}</td>
            <td>${formatDate(activity.date) || 'N/A'}</td>
            <td>${formatDate(activity.endDate || activity.date) || 'N/A'}</td>
            <td>${formatTimeRange(activity.timeStart, activity.timeEnd)}</td>
            <td>${activity.organizer || 'N/A'}</td>
            <td>${activity.takeaways || 'No takeaways provided'}</td>
            <td class="actions-cell">
                <button class="btn-edit" data-program-id="${activity.program_id}">Edit</button>
                <button class="btn-delete" data-program-id="${activity.program_id}">Delete</button>
            </td>
        `;
        tableBody.insertBefore(row, tableBody.firstChild);
        
        // Add event listeners to the new buttons
        row.querySelector('.btn-edit').addEventListener('click', handleEditActivity);
        row.querySelector('.btn-delete').addEventListener('click', handleDeleteActivity);
    }
    
    // Load activities on page load
    loadFacultyActivities();

    function loadFacultyActivities() {
        const activitiesTableBody = document.getElementById('activitiesTableBody');
        if (activitiesTableBody) {
            activitiesTableBody.innerHTML = '<tr><td colspan="8" class="loading-container"><div class="loading-spinner"></div>Loading activities...</td></tr>';
            
            fetch('/faculty/activities')
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => {
                            throw new Error(err.message || 'Failed to load activities');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        activitiesTableBody.innerHTML = '';
                        
                        if (data.activities.length === 0) {
                            showEmptyState('activitiesTableBody', 'No activities found in your history');
                            return;
                        }
                        
                        renderActivities(data.activities);
                    }
                })
                .catch(error => {
                    console.error('Error loading activities:', error);
                    showErrorState('activitiesTableBody', error.message || 'Failed to load activities');
                });
        }
    }
}

// Admin Page Script
if (document.getElementById('admin-page')) {
    console.log('Admin page script loaded');
    
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                }
            })
            .catch(error => console.error('Logout error:', error));
        });
    }
    
    // Load all faculty entries to the admin table
    const entriesTableBody = document.getElementById('entriesTableBody');
    if (entriesTableBody) {
        loadAdminEntries();
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterEntries(this.value.toLowerCase());
        });
    }

    function renderActivities(entries) {
        const tableBody = document.getElementById('entriesTableBody') || document.getElementById('activitiesTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        entries.forEach(entry => {
            const row = document.createElement('tr');
            row.setAttribute('data-entry', 'true');
            
            row.innerHTML = `
                <td>${entry.facultyName || 'N/A'}</td>
                <td>${entry.title || 'N/A'}</td>
                <td>${entry.type || 'N/A'}</td>
                <td>${formatDate(entry.date) || 'N/A'}</td>
                <td>${formatDate(entry.endDate) || 'N/A'}</td>
                <td>${formatTimeRange(entry.timeStart, entry.timeEnd)}</td>
                <td>${entry.organizer || 'N/A'}</td>
                <td>${entry.takeaways || 'N/A'}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    function loadAdminEntries() {
        const entriesTableBody = document.getElementById('entriesTableBody');
        if (!entriesTableBody) return;
        
        entriesTableBody.innerHTML = '<tr><td colspan="9" class="loading-container"><div class="loading-spinner"></div>Loading entries...</td></tr>';
        
        fetch('/admin/entries')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.message || 'Failed to load entries');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    entriesTableBody.innerHTML = '';
                    
                    if (data.entries.length === 0) {
                        showEmptyState('entriesTableBody', 'No entries found in the system');
                        updateStatistics([]);
                        return;
                    }
                    
                    window.allEntries = data.entries;
                    renderActivities(data.entries);
                    updateStatistics(data.entries);
                    sessionStorage.removeItem('adminDataNeedsRefresh');
                }
            })
            .catch(error => {
                console.error('Error loading entries:', error);
                showErrorState('entriesTableBody', error.message || 'Failed to load entries');
            });
    }

    function filterEntries(searchText) {
        if (!window.allEntries) return;
        
        const entriesTableBody = document.getElementById('entriesTableBody');
        if (!entriesTableBody) return;
        
        entriesTableBody.innerHTML = '';
        
        const filteredEntries = window.allEntries.filter(entry => {
            return (entry.facultyName && entry.facultyName.toLowerCase().includes(searchText)) ||
                   (entry.title && entry.title.toLowerCase().includes(searchText)) ||
                   (entry.type && entry.type.toLowerCase().includes(searchText)) ||
                   (entry.organizer && entry.organizer.toLowerCase().includes(searchText)) ||
                   (entry.takeaways && entry.takeaways.toLowerCase().includes(searchText));
        });
        
        if (filteredEntries.length === 0) {
            showEmptyState('entriesTableBody', 'No matching entries found');
        } else {
            renderActivities(filteredEntries);
            updateStatistics(filteredEntries);
        }
    }
}

// Utility Functions for UI States
function showEmptyState() {
    const tableBody = document.getElementById('activitiesTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-message">
                No activities found in your history
            </td>
        </tr>
    `;
}

function showError(message) {
    const tableBody = document.getElementById('activitiesTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="error-message">
                ${message}
            </td>
        </tr>
    `;
}
function updateStatistics(entries) {
    const totalActivities = document.getElementById('totalActivities');
    if (totalActivities) {
        totalActivities.textContent = entries.length;
    }
    
    const uniqueFaculty = entries.length > 0 ? [...new Set(entries.map(entry => entry.facultyName))] : [];
    const facultyCount = document.getElementById('facultyCount');
    if (facultyCount) {
        facultyCount.textContent = uniqueFaculty.length;
    }
    
    const uniqueTypes = entries.length > 0 ? [...new Set(entries.map(entry => entry.type))] : [];
    const activityTypes = document.getElementById('activityTypes');
    if (activityTypes) {
        activityTypes.textContent = uniqueTypes.length;
    }
}

// Initialize page on load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('admin-page') && sessionStorage.getItem('adminDataNeedsRefresh') === 'true') {
        loadAdminEntries();
    }
    
    if (document.getElementById('faculty-page') && sessionStorage.getItem('facultyDataNeedsRefresh') === 'true') {
        loadFacultyActivities();
        sessionStorage.removeItem('facultyDataNeedsRefresh');
    }
});