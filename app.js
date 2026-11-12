// questionsMap is loaded globally from data.js


class App {
    constructor() {
        this.currentGrade = null;
        this.questions = [];
        this.currentIndex = 0;
        this.score = 0;
        this.mistakes = JSON.parse(localStorage.getItem('eiken_mistakes')) || [];
        this.history = JSON.parse(localStorage.getItem('eiken_history')) || []; // List of answered IDs
        this.favorites = JSON.parse(localStorage.getItem('eiken_favorites')) || [];
        this.questionIndex = new Map(Object.entries(window.questionsMap).flatMap(([grade, qs]) =>
            qs.map(q => [q.id, { ...q, grade }])));
        this.libraryMode = 'review';

        this.ui = {
            header: document.querySelector('.app-header'),
            views: {
                home: document.getElementById('home-view'),
                settings: document.getElementById('settings-view'),
                quiz: document.getElementById('quiz-view'),
                library: document.getElementById('library-view'),
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
        const help = document.getElementById('help-dialog');
        document.getElementById('help-btn').addEventListener('click', () => help.showModal());
        ['help-close-btn', 'help-done-btn'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => help.close()));
        help.addEventListener('click', event => {
            if (event.target !== help) return;
            const rect = help.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) help.close();
        });
        // Grade Selection
        this.ui.home.buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const grade = btn.dataset.grade;
                this.prepareSettings(grade);
            });
        });

        // Review
        this.ui.home.reviewBtn.addEventListener('click', () => this.openLibrary('review'));
        document.getElementById('favorites-btn').addEventListener('click', () => this.openLibrary('favorites'));
        document.getElementById('library-back-btn').addEventListener('click', () => this.showHome());
        document.getElementById('library-start-btn').addEventListener('click', () => this.startLibraryPractice());
        document.getElementById('library-grade').addEventListener('change', () => this.populateLibrarySessions());
        document.getElementById('library-session').addEventListener('change', () => this.renderLibrary());
        document.getElementById('library-count').addEventListener('change', () => this.renderLibrary());
        document.getElementById('favorite-toggle').addEventListener('click', () => this.toggleFavorite());

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
            this.ui.home.mistakesCount.textContent = `${count}問を保存中。級・回を選んで解き直せます。`;
        } else {
            this.ui.home.reviewContainer.classList.add('hidden');
        }
        document.getElementById('favorites-count').textContent = `${this.favorites.length}問を保存中`;
    }

    getLibraryQuestions() {
        const saved = this.libraryMode === 'favorites' ? this.favorites : this.mistakes;
        return saved.map(q => this.questionIndex.get(q.id) || {
            ...q, grade: this.gradeFromId(q.id)
        });
    }

    // ID の接頭辞（"pre2plus-001" など）から questionsMap のキーを求める
    gradeFromId(id) {
        const prefix = String(id).split('-')[0];
        const map = { pre1: 'pre-1', pre2: 'pre-2', pre2plus: 'pre-2-plus' };
        return map[prefix] || prefix;
    }

    openLibrary(mode) {
        this.libraryMode = mode;
        document.getElementById('library-title').textContent = mode === 'favorites' ? '付箋・お気に入り' : '間違えた問題の解き直し';
        document.getElementById('library-description').textContent = mode === 'favorites'
            ? '付箋を付けた問題を管理できます。級や回を選んで、少しずつ演習しましょう。'
            : '解き直す級・回・問題数を選べます。取り組みやすい量から始めましょう。';
        const select = document.getElementById('library-grade');
        select.replaceChildren(new Option('すべての級', 'all'));
        [...new Set(this.getLibraryQuestions().map(q => q.grade))].sort().forEach(g =>
            select.add(new Option(this.formatGrade(g), g)));
        document.getElementById('library-count').value = '10';
        document.getElementById('library-order').value = 'random';
        this.populateLibrarySessions();
        this.switchView('library');
    }

    populateLibrarySessions() {
        const grade = document.getElementById('library-grade').value;
        const previous = document.getElementById('library-session').value;
        const qs = this.getLibraryQuestions().filter(q => grade === 'all' || q.grade === grade);
        const select = document.getElementById('library-session');
        select.replaceChildren(new Option('すべての回', 'all'));
        [...new Set(qs.map(q => q.source || '実施回不明'))].sort((a, b) => b.localeCompare(a, 'ja', { numeric: true }))
            .forEach(source => select.add(new Option(source, source)));
        if ([...select.options].some(o => o.value === previous)) select.value = previous;
        this.renderLibrary();
    }

    getFilteredLibraryQuestions() {
        const grade = document.getElementById('library-grade').value;
        const session = document.getElementById('library-session').value;
        return this.getLibraryQuestions().filter(q =>
            (grade === 'all' || q.grade === grade) &&
            (session === 'all' || (q.source || '実施回不明') === session));
    }

    renderLibrary() {
        const qs = this.getFilteredLibraryQuestions();
        const limit = document.getElementById('library-count').value;
        const count = limit === 'all' ? qs.length : Math.min(Number(limit), qs.length);
        document.getElementById('library-summary').textContent = qs.length
            ? `対象 ${qs.length}問 ／ 今回は ${count}問を演習`
            : this.libraryMode === 'favorites'
                ? '該当する問題はありません。問題画面で付箋を付けるか、条件を変更してください。'
                : '該当する問題はありません。条件を変更してください。';
        document.getElementById('library-start-btn').disabled = qs.length === 0;
        const list = document.getElementById('library-list');
        list.replaceChildren();
        if (this.libraryMode !== 'favorites') return;
        qs.forEach(q => {
            const row = document.createElement('li');
            row.className = 'saved-question';
            const content = document.createElement('div');
            const meta = document.createElement('p');
            meta.className = 'saved-meta';
            meta.textContent = `${this.formatGrade(q.grade)} · ${q.source || '実施回不明'} · ${q.id}`;
            const text = document.createElement('p');
            const plain = document.createElement('div');
            plain.innerHTML = q.question;
            text.textContent = plain.textContent;
            content.append(meta, text);
            const remove = document.createElement('button');
            remove.className = 'nav-btn';
            remove.textContent = '付箋を外す';
            remove.setAttribute('aria-label', `${q.id} の付箋を外す`);
            remove.addEventListener('click', () => {
                this.favorites = this.favorites.filter(item => item.id !== q.id);
                this.saveFavorites();
                this.populateLibrarySessions();
            });
            row.append(content, remove);
            list.appendChild(row);
        });
    }

    startLibraryPractice() {
        let qs = this.getFilteredLibraryQuestions();
        if (!qs.length) return;
        if (document.getElementById('library-order').value === 'random') qs = this.shuffleSimple(qs);
        const limit = document.getElementById('library-count').value;
        this.questions = limit === 'all' ? qs : qs.slice(0, Number(limit));
        this.currentGrade = this.libraryMode;
        this.startCommon();
    }

    saveFavorites() {
        localStorage.setItem('eiken_favorites', JSON.stringify(this.favorites));
        this.checkMistakes();
    }

    toggleFavorite() {
        const q = this.questions[this.currentIndex];
        if (this.favorites.some(item => item.id === q.id)) {
            this.favorites = this.favorites.filter(item => item.id !== q.id);
        } else {
            this.favorites.push({ ...q });
        }
        this.saveFavorites();
        this.updateFavoriteButton();
    }

    updateFavoriteButton() {
        const saved = this.favorites.some(q => q.id === this.questions[this.currentIndex].id);
        const button = document.getElementById('favorite-toggle');
        button.textContent = saved ? '付箋を外す' : '付箋を付ける';
        button.setAttribute('aria-pressed', String(saved));
    }

    prepareSettings(grade) {
        this.currentGrade = grade;
        this.ui.settings.title.textContent = `${this.formatGrade(grade)}の演習設定`;
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
        this.ui.settings.countSelect.value = '10';
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
            // Prioritize Unseen Questions
            const seenSet = new Set(this.history);
            const unseen = [];
            const seen = [];

            qs.forEach(q => {
                if (seenSet.has(q.id)) {
                    seen.push(q);
                } else {
                    unseen.push(q);
                }
            });

            // Shuffle both independently
            const shuffledUnseen = this.shuffleSimple(unseen);
            const shuffledSeen = this.shuffleSimple(seen);

            // Combine: Unseen first, then Seen
            qs = [...shuffledUnseen, ...shuffledSeen];
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
        window.scrollTo({ top: 0, behavior: 'instant' });
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
        this.updateFavoriteButton();
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
        const realGrade = this.gradeFromId(q.id);
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

        // Save to History (Mark as seen)
        this.saveHistory(questionObj.id);

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

    saveHistory(id) {
        if (!this.history.includes(id)) {
            this.history.push(id);
            localStorage.setItem('eiken_history', JSON.stringify(this.history));
        }
    }

    formatGrade(g) {
        switch (g) {
            case '5': return '5級';
            case '4': return '4級';
            case '3': return '3級';
            case 'pre-2': return '準2級';
            case 'pre2': return '準2級'; // Handle ID prefix
            case 'pre-2-plus': return '準2級プラス';
            case 'pre2plus': return '準2級プラス';
            case '2': return '2級';
            case 'pre-1': return '準1級';
            case 'pre1': return '準1級'; // Handle ID prefix
            case 'review': return '復習 (Review)';
            case 'favorites': return '付箋の演習';
            default: return g;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
