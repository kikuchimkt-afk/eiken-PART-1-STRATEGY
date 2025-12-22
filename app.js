// questionsMap is loaded globally from data.js


class App {
    constructor() {
        this.currentGrade = null;
        this.questions = [];
        this.currentIndex = 0;
        this.score = 0;
        this.mistakes = JSON.parse(localStorage.getItem('eiken_mistakes')) || [];

        this.ui = {
            header: document.querySelector('.app-header'),
            views: {
                home: document.getElementById('home-view'),
                settings: document.getElementById('settings-view'),
                quiz: document.getElementById('quiz-view'),
            },
            home: {
                buttons: document.querySelectorAll('.grade-card'),
                reviewContainer: document.getElementById('review-container'),
                reviewBtn: document.getElementById('review-btn'),
                mistakesCount: document.getElementById('mistakes-count'),
            },
            settings: {
                view: document.getElementById('settings-view'),
                title: document.getElementById('settings-title'),
                yearSelect: document.getElementById('setting-year'),
                yearCountBadge: document.getElementById('setting-available-count'),
                rangeStart: document.getElementById('setting-range-start'),
                rangeEnd: document.getElementById('setting-range-end'),
                orderSelect: document.getElementById('setting-order'),
                countSelect: document.getElementById('setting-count'),
                startBtn: document.getElementById('quiz-start-btn'),
                backBtn: document.getElementById('settings-back-btn'),
            },
            quiz: {
                homeBtn: document.getElementById('home-btn'),
                gradeDisplay: document.getElementById('current-grade-display'),
                progressText: document.getElementById('progress-text'),
                questionText: document.getElementById('question-text'),
                optionsContainer: document.getElementById('options-container'),
                feedbackSection: document.getElementById('feedback-section'),
                resultBadge: document.getElementById('result-badge'),
                explanationText: document.getElementById('explanation-text'),
                questionSource: document.getElementById('question-source'),
                prevBtn: document.getElementById('prev-btn'),
                nextBtn: document.getElementById('next-btn'),
            }
        };

        this.bindEvents();
        this.checkMistakes();
    }

    bindEvents() {
        // Grade Selection
        this.ui.home.buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const grade = btn.dataset.grade;
                this.prepareSettings(grade);
            });
        });

        // Review
        this.ui.home.reviewBtn.addEventListener('click', () => this.startReview());

        // Settings Actions
        this.ui.settings.startBtn.addEventListener('click', () => this.startFromSettings());
        this.ui.settings.backBtn.addEventListener('click', () => this.showHome());

        // Settings Change Listeners (Real-time count update)
        ['change', 'input'].forEach(evt => {
            this.ui.settings.yearSelect.addEventListener(evt, () => this.updateSettingsCount());
            this.ui.settings.rangeStart.addEventListener(evt, () => this.updateSettingsCount());
            this.ui.settings.rangeEnd.addEventListener(evt, () => this.updateSettingsCount());
        });

        // Navigation
        this.ui.quiz.homeBtn.addEventListener('click', () => this.showHome());

        this.ui.quiz.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.ui.quiz.prevBtn.addEventListener('click', () => this.prevQuestion());
    }

    checkMistakes() {
        const count = this.mistakes.length;
        if (count > 0) {
            this.ui.home.reviewContainer.classList.remove('hidden');
            this.ui.home.mistakesCount.textContent = `${count} questions to review`;
        } else {
            this.ui.home.reviewContainer.classList.add('hidden');
        }
    }

    startReview() {
        this.currentGrade = 'review';
        this.questions = [...this.mistakes]; // Copy
        this.startCommon();
    }

    prepareSettings(grade) {
        this.currentGrade = grade;
        const allQuestions = window.questionsMap[grade] || [];

        if (allQuestions.length === 0) {
            alert("この級の問題はまだありません。(Only Grade 2 is available in this prototype)");
            return;
        }

        // Populate Years
        const years = [...new Set(allQuestions.map(q => q.source || '不明'))].filter(y => y !== '不明').sort();
        this.ui.settings.yearSelect.innerHTML = '<option value="all">すべて (All)</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            this.ui.settings.yearSelect.appendChild(opt);
        });

        // Reset Inputs
        this.ui.settings.rangeStart.value = '';
        this.ui.settings.rangeEnd.value = '';
        this.ui.settings.countSelect.value = 'all';
        this.ui.settings.orderSelect.value = 'id';

        this.updateSettingsCount(); // Initial count
        this.switchView('settings');
    }

    getFilteredQuestionsFromSettings() {
        let qs = window.questionsMap[this.currentGrade] || [];
        if (qs.length === 0) return [];

        // Filter by Year
        const year = this.ui.settings.yearSelect.value;
        if (year !== 'all') {
            qs = qs.filter(q => q.source === year);
        }

        // Filter by Range
        const start = parseInt(this.ui.settings.rangeStart.value);
        const end = parseInt(this.ui.settings.rangeEnd.value);

        if (!isNaN(start) || !isNaN(end)) {
            qs = qs.filter(q => {
                const parts = q.id.split('-');
                const num = parseInt(parts[parts.length - 1]);
                if (isNaN(num)) return true;
                const s = isNaN(start) ? -Infinity : start;
                const e = isNaN(end) ? Infinity : end;
                return num >= s && num <= e;
            });
        }
        return qs;
    }

    updateSettingsCount() {
        const qs = this.getFilteredQuestionsFromSettings();
        if (this.ui.settings.yearCountBadge) {
            this.ui.settings.yearCountBadge.textContent = `${qs.length}問`;
        }
    }

    // Generic shuffle
    shuffleSimple(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    startFromSettings() {
        let qs = this.getFilteredQuestionsFromSettings();



        // Filter by Range (assuming sequential numeric part in ID, e.g. "2-001" -> 1)
        const start = parseInt(this.ui.settings.rangeStart.value);
        const end = parseInt(this.ui.settings.rangeEnd.value);

        if (!isNaN(start) || !isNaN(end)) {
            qs = qs.filter(q => {
                // Extract number from ID (last 3 digits usually) or simply split by '-'
                const parts = q.id.split('-');
                const num = parseInt(parts[parts.length - 1]);
                if (isNaN(num)) return true; // Keep if parsed error

                const s = isNaN(start) ? -Infinity : start;
                const e = isNaN(end) ? Infinity : end;
                return num >= s && num <= e;
            });
        }

        if (qs.length === 0) {
            alert("該当する問題がありません。条件を変更してください。");
            return;
        }

        // Order
        const order = this.ui.settings.orderSelect.value;
        if (order === 'random') {
            qs = this.shuffleSimple(qs);
        }

        // Filter by Count (Slice)
        const countVal = this.ui.settings.countSelect.value;
        if (countVal !== 'all') {
            const limit = parseInt(countVal);
            if (qs.length > limit) {
                qs = qs.slice(0, limit);
            }
        }



        this.questions = qs;
        this.startCommon();
    }

    // Removed old startQuiz in favor of prepareSettings -> startFromSettings flow
    // kept for reference or direct calls if needed, but logic moved.

    startCommon() {
        this.currentIndex = 0;
        this.score = 0;
        // Initialize state
        this.quizState = new Array(this.questions.length).fill(null).map(() => ({
            answered: false,
            selectedOption: null,
            isCorrect: false,
            shuffledOptions: null
        }));

        this.switchView('quiz');
        this.renderQuestion();
    }

    switchView(viewName) {
        Object.values(this.ui.views).forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });
        const target = this.ui.views[viewName];
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
        }

        // Toggle Header Visibility
        if (viewName === 'quiz') {
            this.ui.header.classList.add('hidden');
        } else {
            this.ui.header.classList.remove('hidden');
        }
    }

    showHome() {
        this.switchView('home');
        this.checkMistakes();
    }

    // Fisher-Yates shuffle
    shuffleArray(options, meanings) {
        // Create pairs
        const arr = options.map((opt, i) => ({
            text: opt,
            meaning: meanings ? meanings[i] : ''
        }));

        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    renderQuestion() {
        const q = this.questions[this.currentIndex];
        const state = this.quizState[this.currentIndex];

        // Prepare Shuffled Options if not exists
        if (!state.shuffledOptions) {
            state.shuffledOptions = this.shuffleArray(q.options, q.optionMeanings);
        }
        const currentOptions = state.shuffledOptions;

        // Update Header
        // Update Header
        const displayedGradeHeader = this.formatGrade(this.currentGrade);
        this.ui.quiz.gradeDisplay.textContent = displayedGradeHeader;
        this.ui.quiz.progressText.textContent = `${this.currentIndex + 1} / ${this.questions.length}`;

        // Determing Real Grade from ID for Footer
        const idParts = q.id.split('-');
        let realGrade = idParts[0];
        if (realGrade === 'pre') realGrade = `pre-${idParts[1]}`;
        const realGradeDisplay = this.formatGrade(realGrade);

        // Recover Source if missing (for Review)
        let source = q.source;
        if (!source) {
            const originalQ = (window.questionsMap[realGrade] || []).find(item => item.id === q.id);
            if (originalQ) source = originalQ.source;
        }
        const sourceText = source || '不明';

        this.ui.quiz.questionSource.textContent = `${realGradeDisplay} ${sourceText}`;

        // Update Question Text
        this.ui.quiz.questionText.innerHTML = q.question.replace(/\n/g, '<br>');

        // Render Options
        this.ui.quiz.optionsContainer.innerHTML = '';

        // Reset Reveal State
        this.ui.quiz.optionsContainer.classList.remove('reveal-answers');
        if (state.answered) {
            this.ui.quiz.optionsContainer.classList.add('reveal-answers');
        }

        currentOptions.forEach(optObj => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';

            // Create inner HTML for spacing
            btn.innerHTML = `<span class="opt-en">${optObj.text}</span> <span class="opt-jp">${optObj.meaning}</span>`;
            btn.dataset.answer = optObj.text;

            // If already answered

            // If already answered
            if (state.answered) {
                btn.disabled = true;
                if (optObj.text === q.answer) {
                    btn.classList.add('correct');
                } else if (optObj.text === state.selectedOption && !state.isCorrect) {
                    btn.classList.add('incorrect');
                }
            } else {
                btn.onclick = () => this.handleAnswer(btn, optObj.text, q);
            }

            this.ui.quiz.optionsContainer.appendChild(btn);
        });

        // Feedback Section State
        if (state.answered) {
            this.ui.quiz.feedbackSection.classList.remove('hidden');

            // Explanation Content
            let html = '';
            if (q.translation) {
                html += `<div class="translation-box">${q.translation.replace(/\n/g, '<br>')}</div>`;
            }
            // Use new formatter
            html += this.formatExplanationHTML(q.explanation);

            this.ui.quiz.explanationText.innerHTML = html;

            this.ui.quiz.resultBadge.className = `result-badge ${state.isCorrect ? 'correct' : 'incorrect'}`;
            this.ui.quiz.resultBadge.textContent = state.isCorrect ? '正解 (Correct)' : '不正解 (Incorrect)';

            this.ui.quiz.nextBtn.disabled = false;
        } else {
            this.ui.quiz.feedbackSection.classList.add('hidden');
            this.ui.quiz.explanationText.innerHTML = '';
            this.ui.quiz.nextBtn.disabled = true;
        }

        // Nav State
        this.ui.quiz.prevBtn.disabled = this.currentIndex === 0;
    }

    // Helper to format explanation text into rich HTML
    formatExplanationHTML(text) {
        if (!text) return '';

        // 1. Extract Answer Header
        let header = '';
        let body = text;
        const headerMatch = text.match(/^(<b>正解：.*?<\/b>|【.*?】)/);
        if (headerMatch) {
            header = headerMatch[0];
            body = text.substring(header.length).trim();
        }

        // 2. Split Vocabulary List (bullet points ・)
        const vocabSplitIndex = body.search(/(^|\n)・/);

        let reason = body;
        let vocabList = [];

        if (vocabSplitIndex !== -1) {
            reason = body.substring(0, vocabSplitIndex).trim();
            const vocabSection = body.substring(vocabSplitIndex).trim();
            vocabList = vocabSection.split(/\n?・/).filter(s => s.trim()).map(s => s.trim());
        }

        // 3. Construct HTML
        let html = '';

        // Reason Section
        if (reason) {
            let formattedReason = reason.trim().replace(/\n/g, '<br>');
            html += `<div class="expl-reason">
                <div class="expl-label">💡 解説・ポイント</div>
                <div class="expl-text">${formattedReason}</div>
            </div>`;
        }

        // Vocabulary Section
        if (vocabList.length > 0) {
            html += `<div class="expl-vocab">
                <div class="expl-label">📚 重要語彙・選択肢</div>
                <ul class="expl-list">`;
            vocabList.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += `</ul></div>`;
        }

        // If split failed or simple text, fallback
        if (!header && !reason && !vocabList.length) {
            return text.replace(/\n/g, '<br>');
        }

        // Add Header at top if desired, or skip it since badge shows Correct/Incorrect.
        // User asked for detailed explanation, repeating Answer Word is redundant but safe.
        if (header) {
            html = `<div class="expl-header">${header}</div>` + html;
        }

        return html;
    }

    handleAnswer(selectedBtn, selectedOption, questionObj) {
        const isCorrect = selectedOption === questionObj.answer;

        // Save State
        this.quizState[this.currentIndex] = {
            answered: true,
            selectedOption: selectedOption,
            isCorrect: isCorrect
        };

        if (isCorrect) {
            this.score++;
        } else {
            this.saveMistake(questionObj);
        }

        // Disable all options visually (handled by re-render, but for instant feedback:)
        const allBtns = this.ui.quiz.optionsContainer.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.disabled = true);

        if (isCorrect) {
            selectedBtn.classList.add('correct');
        } else {
            selectedBtn.classList.add('incorrect');
            // Highlight correct
            allBtns.forEach(b => {
                if (b.dataset.answer === questionObj.answer) b.classList.add('correct');
            });
        }

        // Show Feedback
        this.ui.quiz.optionsContainer.classList.add('reveal-answers'); // Reveal meanings

        this.ui.quiz.resultBadge.className = `result-badge ${isCorrect ? 'correct' : 'incorrect'}`;
        this.ui.quiz.resultBadge.textContent = isCorrect ? '正解 (Correct)' : '不正解 (Incorrect)';

        // Explanation Content
        let html = '';
        if (questionObj.translation) {
            html += `<div class="translation-box">${questionObj.translation.replace(/\n/g, '<br>')}</div>`;
        }
        // Use new formatter
        html += this.formatExplanationHTML(questionObj.explanation);
        this.ui.quiz.explanationText.innerHTML = html;

        this.ui.quiz.feedbackSection.classList.remove('hidden');

        // Enable Next
        this.ui.quiz.nextBtn.disabled = false;
    }

    nextQuestion() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.renderQuestion();
        } else {
            // End of Quiz
            alert(`終了！ 結果: ${this.score} / ${this.questions.length}`);
            this.showHome();
        }
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderQuestion();
        }
    }

    saveMistake(question) {
        // Avoid duplicates
        if (!this.mistakes.find(m => m.id === question.id)) {
            this.mistakes.push({
                ...question,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('eiken_mistakes', JSON.stringify(this.mistakes));
            console.log("Mistake saved:", question.id);
        }
    }

    formatGrade(g) {
        switch (g) {
            case '3': return '3級';
            case 'pre-2': return '準2級';
            case 'pre2': return '準2級'; // Handle ID prefix
            case '2': return '2級';
            case 'pre-1': return '準1級';
            case 'pre1': return '準1級'; // Handle ID prefix
            case 'review': return '復習 (Review)';
            default: return g;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
