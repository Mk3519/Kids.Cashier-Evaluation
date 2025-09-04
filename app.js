// Google Apps Script deployment URL (you'll need to replace this with your actual deployment URL)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4fYZfNgIBSrnKXeo7jJESyI0-hoyIJLUPLHDHWMgI_axvZi93DvWQn3mnvpKMc9W22Q/exec';

// Password visibility toggle
document.getElementById('togglePassword').addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = this.querySelector('.eye-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.style.opacity = '0.7';
    } else {
        passwordInput.type = 'password';
        eyeIcon.style.opacity = '1';
    }
});

// Handle login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show login loader
    document.getElementById('loginLoader').style.display = 'block';
    document.getElementById('loginForm').classList.add('form-disabled');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userEmail', email);
            document.getElementById('mainContainer').style.display = 'block';
            document.getElementById('loginContainer').style.display = 'none';
            showLoginMessage('Login successful!', 'success');
            setTimeout(() => {
                document.getElementById('mainContainer').style.display = 'block';
                document.getElementById('loginContainer').style.display = 'none';
            }, 1000);
        } else {
            showLoginMessage('Invalid email or password', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginMessage('Error during login. Please try again.', 'error');
    } finally {
        // Hide login loader
        document.getElementById('loginLoader').style.display = 'none';
        document.getElementById('loginForm').classList.remove('form-disabled');
    }
});

// دوال التحكم في عرض وإخفاء دائرة التحميل
function showLoader() {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('cashierEvaluation').classList.add('form-disabled');
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('cashierEvaluation').classList.remove('form-disabled');
}

// دالة لجلب بيانات الموظفين من Google Sheets
async function fetchEmployees() {
    showLoader();
    try {
        console.log('Fetching employees from:', `${SCRIPT_URL}?action=getEmployees`);
        const response = await fetch(`${SCRIPT_URL}?action=getEmployees`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.success || !Array.isArray(data.data)) {
            throw new Error('Invalid response format');
        }
        
        console.log('Received employees data:', data);
        return data.data;
    } catch (error) {
        console.error('Error fetching employees:', error);
        showMessage('حدث خطأ في جلب بيانات الموظفين: ' + error.message, 'error');
        return [];
    } finally {
        hideLoader();
    }
}

// تحديث قائمة الموظفين في النموذج
async function populateEmployeeDropdown() {
    const employeeSelect = document.getElementById('employeeName');
    employeeSelect.innerHTML = '<option value="">Choose Employee</option>';
    
    try {
        const employees = await fetchEmployees();
        if (Array.isArray(employees) && employees.length > 0) {
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.code; // استخدام كود الموظف كقيمة
                option.textContent = `${employee.name} - ${employee.title}`; // عرض الاسم والمسمى الوظيفي
                employeeSelect.appendChild(option);
            });
        } else {
            showMessage('لا يوجد موظفين في القائمة', 'error');
        }
    } catch (error) {
        console.error('Error populating employee dropdown:', error);
        showMessage('خطأ في تحميل قائمة الموظفين', 'error');
    }
}

// تحميل بيانات الموظفين عند تحميل الصفحة
// Logout functionality
document.getElementById('logoutButton')?.addEventListener('click', function() {
    // Clear session storage
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userEmail');
    
    // Show login container and hide main container
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'none';
    
    // Clear form fields
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    
    // Show logout message
    showLoginMessage('Logged out successfully', 'success');
});

document.addEventListener('DOMContentLoaded', function() {
    populateEmployeeDropdown();
});

// Handle form submission
document.getElementById('cashierEvaluation').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader();
    
    const employeeName = document.getElementById('employeeName').value;
    const shortageAmount = document.getElementById('shortageAmount').value || 0;
    const surplusAmount = document.getElementById('surplusAmount').value || 0;
    const exitSheetMissing = document.getElementById('exitSheetMissing').value || 0;
    const cancelAmount = document.getElementById('cancelAmount').value || 0;
    
    if (!employeeName) {
        showMessage('Please select an employee', 'error');
        return;
    }

    // Find selected employee data
    const employees = await fetchEmployees();
    const selectedEmployee = employees.find(emp => emp.code === employeeName);
    
    if (!selectedEmployee) {
        showMessage('Employee data not found', 'error');
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employeeName: selectedEmployee.name,
                employeeCode: selectedEmployee.code,
                employeeTitle: selectedEmployee.title,
                shortageAmount: parseFloat(shortageAmount),
                surplusAmount: parseFloat(surplusAmount),
                exitSheetMissing: parseInt(exitSheetMissing),
                cancelAmount: parseFloat(cancelAmount),
                date: new Date().toISOString()
            })
        });

        showMessage('Evaluation saved successfully', 'success');
        resetForm();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error saving data', 'error');
    } finally {
        hideLoader();
    }
});

// Function to show login messages
function showLoginMessage(text, type) {
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Function to show general messages
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 3000);
}

function resetForm() {
    document.getElementById('cashierEvaluation').reset();
}