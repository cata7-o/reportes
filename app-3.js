// Importamos las funciones necesarias de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
// 1. Ve a console.firebase.google.com
// 2. Crea un proyecto web
// 3. Copia las credenciales aquí:
const firebaseConfig = {
    apiKey: "AIzaSyCFHdhTIL-_Ic--itOf2puwtnuY-vlaa2E",
    authDomain: "sistemacalificaciones-6116b.firebaseapp.com",
    projectId: "sistemacalificaciones-6116b",
    storageBucket: "sistemacalificaciones-6116b.firebasestorage.app",
    messagingSenderId: "743937455512",
    appId: "1:743937455512:web:9afde9fc771e96682ca7ed"
};

// Inicializar Firebase
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);

class GradingSystem {
    constructor() {
        this.currentUser = null;
        this.subjects = [];
        this.students = {}; 
        this.grades = {};
        
        // Exponemos la instancia al objeto window para que el HTML pueda acceder a las funciones
        // ya que al ser un modulo, las funciones no son globales por defecto.
        window.app = this;
        
        this.init();
    }

    init() {
        this.checkLogin();
    }

    // --- Authentication Methods (Ahora asíncronos para consultar la nube) ---

    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            this.showAlert('Por favor ingresa usuario y contraseña', 'error');
            return;
        }

        try {
            // Buscamos el usuario en la colección "users" de Firebase
            const docRef = doc(db, "users", username);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.password === password) {
                    this.currentUser = {
                        username: username,
                        fullName: userData.fullName
                    };
                    
                    // Guardamos la sesión en el navegador (sessionStorage se borra al cerrar el navegador)
                    sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    
                    this.showAlert('Bienvenido ' + this.currentUser.fullName, 'success');
                    await this.showMainApp(); // Esperamos a cargar los datos
                } else {
                    this.showAlert('Contraseña incorrecta', 'error');
                }
            } else {
                this.showAlert('El usuario no existe', 'error');
            }
        } catch (error) {
            console.error("Error en login:", error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    async register() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const fullName = document.getElementById('registerFullName').value.trim();

        if (!username || !password || !fullName) {
            this.showAlert('Por favor completa todos los campos', 'error');
            return;
        }

        try {
            const docRef = doc(db, "users", username);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                this.showAlert('El usuario ya existe', 'error');
                return;
            }

            // Guardamos el nuevo usuario en Firebase
            await setDoc(doc(db, "users", username), {
                password: password,
                fullName: fullName
            });

            // Inicializamos su documento de datos vacío
            await setDoc(doc(db, "data", username), {
                subjects: [],
                students: {},
                grades: {}
            });

            this.showAlert('Usuario registrado exitosamente', 'success');
            this.showLogin();

        } catch (error) {
            console.error("Error en registro:", error);
            this.showAlert('Error al registrar usuario', 'error');
        }
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
        // Limpiamos datos en memoria
        this.subjects = [];
        this.students = {};
        this.grades = {};
        this.showLoginForm();
    }

    checkLogin() {
        // Revisamos si hay una sesión activa en este navegador
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
        } else {
            this.showLoginForm();
        }
    }

    // --- UI Management ---
    
    showLogin() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('registerSection').classList.add('hidden');
    }

    showRegister() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('registerSection').classList.remove('hidden');
    }

    showLoginForm() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    async showMainApp() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        await this.loadData(); // Cargamos los datos de la nube
        this.setupEventListeners();
        this.updateAllUI();
    }

    // --- Data Management (Nube) ---

    async loadData() {
        if (!this.currentUser) return;
        
        try {
            // Cargamos los datos desde la colección "data" usando el username como ID
            const docRef = doc(db, "data", this.currentUser.username);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.subjects = data.subjects || [];
                // Convertimos students de vuelta a objeto si Firebase lo guardó diferente, 
                // aunque Firestore maneja objetos JSON bien.
                this.students = data.students || {};
                this.grades = data.grades || {};
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
            this.showAlert('Error cargando tus datos', 'error');
        }
    }

    async saveData() {
        if (!this.currentUser) return;
        
        const data = {
            subjects: this.subjects,
            students: this.students, // Firebase guarda objetos anidados automáticamente
            grades: this.grades
        };
        
        try {
            // Guardamos (sobrescribimos) los datos en la nube
            await setDoc(doc(db, "data", this.currentUser.username), data);
            // Opcional: mostrar un indicador pequeño de "Guardado"
        } catch (error) {
            console.error("Error guardando datos:", error);
            this.showAlert('Error al guardar cambios en la nube', 'error');
        }
    }

    // --- Subject Management ---
    async addSubject() {
        const subjectName = document.getElementById('subjectName').value.trim();
        
        if (!subjectName) {
            this.showAlert('Por favor ingresa el nombre de la materia', 'error');
            return;
        }

        if (this.subjects.includes(subjectName)) {
            this.showAlert('La materia ya existe', 'error');
            return;
        }

        this.subjects.push(subjectName);
        this.students[this.subjects.length - 1] = []; 
        
        await this.saveData(); // Guardar en nube
        this.updateAllUI();
        document.getElementById('subjectName').value = '';
        this.showAlert('Materia agregada', 'success');
    }

    async removeSubject(index) {
        if (confirm('¿Estás seguro? Se eliminarán todos los datos de esta materia.')) {
            this.subjects.splice(index, 1);
            
            const newStudents = {};
            for (let i = 0; i < this.subjects.length; i++) {
                if (i < index) {
                    newStudents[i] = this.students[i] || [];
                } else {
                    newStudents[i] = this.students[i + 1] || [];
                }
            }
            this.students = newStudents;
            
            for (let gradeKey in this.grades) {
                if (gradeKey.includes(`_${index}_`)) { // Lógica simplificada de limpieza
                    delete this.grades[gradeKey];
                }
            }
            
            await this.saveData();
            this.updateAllUI();
            this.showAlert('Materia eliminada', 'success');
        }
    }

    // --- Student Management ---
    async addStudent() {
        const studentName = document.getElementById('studentName').value.trim();
        const selectedSubjectIndex = document.getElementById('studentSubjectSelect').value;
        
        if (!studentName || selectedSubjectIndex === '') {
            this.showAlert('Completa los campos', 'error');
            return;
        }

        const subjectIndex = parseInt(selectedSubjectIndex);
        
        if (!this.students[subjectIndex]) {
            this.students[subjectIndex] = [];
        }

        this.students[subjectIndex].push(studentName);
        await this.saveData();
        this.updateAllUI();
        document.getElementById('studentName').value = '';
        this.showAlert('Estudiante agregado', 'success');
    }

    async removeStudent(subjectIndex, studentIndex) {
        if (confirm('¿Eliminar estudiante?')) {
            this.students[subjectIndex].splice(studentIndex, 1);
            // Limpieza básica de notas (idealmente sería más exhaustiva)
            await this.saveData();
            this.updateAllUI();
            this.showAlert('Estudiante eliminado', 'success');
        }
    }

    // --- Grade Management ---
    async updateGrade(subjectIndex, studentIndex, partial, value) {
        const grade = parseFloat(value);
        
        if (isNaN(grade) || grade < 0 || grade > 10) {
            this.showAlert('La calificación debe ser entre 0 y 10', 'error');
            return;
        }

        const key = `subject_${subjectIndex}_student_${studentIndex}_partial_${partial}`;
        this.grades[key] = grade;
        
        // Guardamos en la nube cada vez que se edita una nota
        // Para evitar demasiadas peticiones, podrías poner un botón de "Guardar Cambios",
        // pero para uso ligero, guardar al cambiar está bien.
        await this.saveData(); 
        this.renderGradesMatrix();
    }

    // ... (El resto de métodos de cálculo y UI se mantienen casi iguales, solo quitando LocalStorage) ...

    getGrade(subjectIndex, studentIndex, partial) {
        const key = `subject_${subjectIndex}_student_${studentIndex}_partial_${partial}`;
        return this.grades[key] || '';
    }

    calculateAverage(subjectIndex, studentIndex) {
        const grade1 = this.getGrade(subjectIndex, studentIndex, 1);
        const grade2 = this.getGrade(subjectIndex, studentIndex, 2);
        const grade3 = this.getGrade(subjectIndex, studentIndex, 3);
        if (grade1 === '' || grade2 === '' || grade3 === '') return '';
        return ((grade1 + grade2 + grade3) / 3).toFixed(1);
    }

    calculateTotal(subjectIndex, studentIndex) {
        const grade1 = this.getGrade(subjectIndex, studentIndex, 1);
        const grade2 = this.getGrade(subjectIndex, studentIndex, 2);
        const grade3 = this.getGrade(subjectIndex, studentIndex, 3);
        if (grade1 === '' || grade2 === '' || grade3 === '') return '';
        return (grade1 + grade2 + grade3).toFixed(1);
    }

    getStatus(subjectIndex, studentIndex) {
        const grade1 = this.getGrade(subjectIndex, studentIndex, 1);
        const grade2 = this.getGrade(subjectIndex, studentIndex, 2);
        const grade3 = this.getGrade(subjectIndex, studentIndex, 3);
        if (grade1 === '' || grade2 === '' || grade3 === '') return '';
        
        const total = grade1 + grade2 + grade3;
        const failedPartials = [grade1, grade2, grade3].filter(g => g < 6).length;
        
        if (total >= 18 && failedPartials <= 1) return 'APROBADO';
        else if (total >= 17) return 'EXTRAORDINARIO';
        else return 'EXTRAORDINARIO';
    }

    showTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabName + 'Tab').classList.add('active');
        
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(
                tabName === 'subjects' ? 'materias' : 
                tabName === 'students' ? 'estudiantes' :
                tabName === 'grades' ? 'calificaciones' : 'reportes')) {
                btn.classList.add('active');
            }
        });
        this.updateAllUI();
    }

    setupEventListeners() {
        const studentSelect = document.getElementById('studentSubjectSelect');
        const gradesSelect = document.getElementById('gradesSubjectSelect');
        
        // Clonar para limpiar eventos anteriores
        const newStudentSelect = studentSelect.cloneNode(true);
        const newGradesSelect = gradesSelect.cloneNode(true);
        
        studentSelect.parentNode.replaceChild(newStudentSelect, studentSelect);
        gradesSelect.parentNode.replaceChild(newGradesSelect, gradesSelect);
        
        document.getElementById('studentSubjectSelect').addEventListener('change', (e) => {
            if (e.target.value === '') {
                document.getElementById('studentNameSection').classList.add('hidden');
            } else {
                document.getElementById('studentNameSection').classList.remove('hidden');
            }
        });

        document.getElementById('gradesSubjectSelect').addEventListener('change', () => {
            this.renderGradesMatrix();
        });
    }

    updateAllUI() {
        this.renderSubjects();
        this.renderStudents();
        this.populateSubjectSelectors();
        this.renderGradesMatrix();
    }

    populateSubjectSelectors() {
        const studentSelect = document.getElementById('studentSubjectSelect');
        const gradesSelect = document.getElementById('gradesSubjectSelect');
        const reportSelect = document.getElementById('reportSubjectSelect');
        
        const currentStudentVal = studentSelect.value;
        const currentGradesVal = gradesSelect.value;
        const currentReportVal = reportSelect.value;

        const createOptions = () => {
            let html = '<option value="">-- Selecciona una materia --</option>';
            this.subjects.forEach((subject, index) => {
                html += `<option value="${index}">${subject}</option>`;
            });
            return html;
        };
        
        const optionsHtml = createOptions();
        studentSelect.innerHTML = optionsHtml;
        gradesSelect.innerHTML = optionsHtml;
        reportSelect.innerHTML = optionsHtml;
        
        // Restaurar selecciones si es posible
        if(currentStudentVal && this.subjects[currentStudentVal]) studentSelect.value = currentStudentVal;
        if(currentGradesVal && this.subjects[currentGradesVal]) gradesSelect.value = currentGradesVal;
        if(currentReportVal && this.subjects[currentReportVal]) reportSelect.value = currentReportVal;

        if (this.subjects.length === 0) {
            document.getElementById('studentFormSection').classList.add('hidden');
            document.getElementById('noSubjectsMessage').classList.remove('hidden');
        } else {
            document.getElementById('studentFormSection').classList.remove('hidden');
            document.getElementById('noSubjectsMessage').classList.add('hidden');
        }
    }

    renderSubjects() {
        const container = document.getElementById('subjectsList');
        if (this.subjects.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>No hay materias</h4></div>';
            return;
        }
        container.innerHTML = '';
        this.subjects.forEach((subject, index) => {
            const div = document.createElement('div');
            div.className = 'subject-item';
            div.innerHTML = `
                <span class="subject-name">${subject}</span>
                <button class="remove-btn" onclick="app.removeSubject(${index})">Eliminar</button>
            `;
            container.appendChild(div);
        });
    }

    renderStudents() {
        const container = document.getElementById('studentsList');
        if (this.subjects.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Crea materias primero.</p></div>';
            return;
        }
        container.innerHTML = '';
        
        this.subjects.forEach((subject, subjectIndex) => {
            const subjectStudents = this.students[subjectIndex] || [];
            if (subjectStudents.length === 0) return;

            const subjectGroup = document.createElement('div');
            subjectGroup.className = 'subject-group';
            
            subjectGroup.innerHTML = `<div class="subject-group-header">${subject}</div>`;
            
            const studentsContainer = document.createElement('div');
            studentsContainer.className = 'students-for-subject';
            
            subjectStudents.forEach((student, studentIndex) => {
                const div = document.createElement('div');
                div.className = 'student-item';
                div.innerHTML = `
                    <span class="student-name">${student}</span>
                    <button class="remove-btn" onclick="app.removeStudent(${subjectIndex}, ${studentIndex})">Eliminar</button>
                `;
                studentsContainer.appendChild(div);
            });
            subjectGroup.appendChild(studentsContainer);
            container.appendChild(subjectGroup);
        });
    }

    renderGradesMatrix() {
        const container = document.getElementById('gradesMatrix');
        const selectedSubjectIndex = document.getElementById('gradesSubjectSelect').value;
        
        if (selectedSubjectIndex === '') {
            container.innerHTML = '<div class="empty-state"><p>Selecciona una materia.</p></div>';
            return;
        }

        const subjectIndex = parseInt(selectedSubjectIndex);
        const subjectStudents = this.students[subjectIndex] || [];
        
        if (subjectStudents.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Sin estudiantes.</p></div>';
            return;
        }

        let html = `
            <table class="grades-table">
                <thead>
                    <tr>
                        <th>Estudiante</th>
                        <th>P1</th><th>P2</th><th>P3</th>
                        <th>Prom</th><th>Total</th><th>Estatus</th>
                    </tr>
                </thead>
                <tbody>
        `;

        subjectStudents.forEach((student, studentIndex) => {
            const average = this.calculateAverage(subjectIndex, studentIndex);
            const total = this.calculateTotal(subjectIndex, studentIndex);
            const status = this.getStatus(subjectIndex, studentIndex);
            
            let statusClass = '';
            if (status === 'APROBADO') statusClass = 'status-approved';
            else if (status === 'EXTRAORDINARIO') statusClass = 'status-extraordinary';
            else if (status === 'REPROBADO') statusClass = 'status-failed';

            html += `
                <tr>
                    <td><strong>${student}</strong></td>
                    <td><input type="number" class="grade-input" 
                              value="${this.getGrade(subjectIndex, studentIndex, 1)}"
                              onchange="app.updateGrade(${subjectIndex}, ${studentIndex}, 1, this.value)"></td>
                    <td><input type="number" class="grade-input" 
                              value="${this.getGrade(subjectIndex, studentIndex, 2)}"
                              onchange="app.updateGrade(${subjectIndex}, ${studentIndex}, 2, this.value)"></td>
                    <td><input type="number" class="grade-input" 
                              value="${this.getGrade(subjectIndex, studentIndex, 3)}"
                              onchange="app.updateGrade(${subjectIndex}, ${studentIndex}, 3, this.value)"></td>
                    <td>${average}</td>
                    <td>${total}</td>
                    <td><span class="status ${statusClass}">${status.substring(0,4)}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // Reemplaza tu función generatePDFReport existente con esta:
    generatePDFReport() {
        // Verificar si hay datos
        if (this.subjects.length === 0) { 
            this.showAlert('No hay materias registradas para generar reporte', 'warning'); 
            return; 
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // --- CONFIGURACIÓN DE ESTILOS ---
        const primaryColor = [33, 128, 141]; // Color Teal de tu CSS
        const grayColor = [100, 100, 100];
        
        // --- ENCABEZADO DEL DOCUMENTO ---
        // Título Principal
        doc.setFontSize(22);
        doc.setTextColor(...primaryColor);
        doc.text("Reporte General de Calificaciones", 105, 20, { align: 'center' });
        
        // Línea separadora
        doc.setLineWidth(0.5);
        doc.setDrawColor(...primaryColor);
        doc.line(14, 25, 196, 25);
        
        // Datos del Docente y Fecha
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        const teacherName = this.currentUser ? this.currentUser.fullName : "No identificado";
        const today = new Date().toLocaleDateString('es-MX', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        doc.text(`Docente: ${teacherName}`, 14, 35);
        doc.text(`Fecha de emisión: ${today}`, 14, 41);

        // --- GENERACIÓN DE TABLAS POR MATERIA ---
        let finalY = 50; // Posición inicial vertical

        this.subjects.forEach((subject, subjectIndex) => {
            const subjectStudents = this.students[subjectIndex] || [];
            
            // Si la materia no tiene alumnos, la saltamos (o puedes dejarla vacía)
            if (subjectStudents.length === 0) return;

            // Preparar los datos para la tabla
            const tableBody = subjectStudents.map((student, studentIndex) => {
                const p1 = this.getGrade(subjectIndex, studentIndex, 1) || '-';
                const p2 = this.getGrade(subjectIndex, studentIndex, 2) || '-';
                const p3 = this.getGrade(subjectIndex, studentIndex, 3) || '-';
                const avg = this.calculateAverage(subjectIndex, studentIndex) || '-';
                const status = this.getStatus(subjectIndex, studentIndex) || '-';
                
                return [student, p1, p2, p3, avg, status];
            });

            // Título de la Materia antes de la tabla
            // Verificamos si necesitamos nueva página antes de imprimir el título
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(...primaryColor);
            doc.setFont(undefined, 'bold');
            doc.text(`Materia: ${subject}`, 14, finalY);
            
            // Generar tabla usando autoTable
            doc.autoTable({
                startY: finalY + 5,
                head: [['Estudiante', 'P1', 'P2', 'P3', 'Prom', 'Estatus']],
                body: tableBody,
                theme: 'grid',
                headStyles: { 
                    fillColor: primaryColor, 
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 80 }, // Columna nombre más ancha
                    4: { fontStyle: 'bold' }, // Promedio en negrita
                    5: { fontStyle: 'bold' }  // Estatus en negrita
                },
                // Función para colorear filas según estatus
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        const text = data.cell.raw;
                        if (text === 'APROBADO') {
                            data.cell.styles.textColor = [33, 128, 141]; // Verde/Teal
                        } else if (text === 'REPROBADO') {
                            data.cell.styles.textColor = [192, 21, 47]; // Rojo
                        } else {
                            data.cell.styles.textColor = [168, 75, 47]; // Naranja (Extraordinario)
                        }
                    }
                }
            });

            // Actualizar la posición Y para la siguiente tabla
            finalY = doc.lastAutoTable.finalY + 15;
        });

        // Pie de página con número de página
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Sistema de Calificaciones - Reporte Oficial', 105, 290, { align: 'center' });
            doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
        }
        
        doc.save(`Reporte_Global_${this.currentUser.username}.pdf`);
    }

// Inicialización
const system = new GradingSystem();
