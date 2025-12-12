// ========================================
// nipo/ff14/timeline.js
// タイムライン管理（肉体：表示・操作・保存）
// ========================================

// タイムライン行を追加する関数
function addTimelineRow(insertAfterRow = null) {
    const timeline = document.getElementById('timeline');
    const footerActions = timeline.querySelector('.timeline-footer-actions');
    
    const elapsedDiv = document.createElement('div');
    elapsedDiv.className = 'elapsed-time-display';
    
    const row = document.createElement('div');
    row.className = 'timeline-row';
    
    row.innerHTML = `
        <div class="timeline-info-row">
            <div>
                <input type="checkbox" class="row-checkbox" style="display: none;">
                <input type="text" class="phase-input" placeholder="フェーズ名">
            </div>
            <div class="time-picker-wrapper">
                <input type="text" class="time-input" placeholder="0:00">
                <div class="time-picker-dropdown hidden">
                    <div class="time-picker-scroll minutes-scroll"></div>
                    <div class="time-picker-scroll seconds-scroll"></div>
                </div>
            </div>
            <div class="memo-container">
                <input type="text" class="memo-input" placeholder="メモ">
            </div>
            <div>
                <button class="attack-type-btn physical-btn" data-type="physical">
                    <img src="ff14/physical.png" alt="物理" class="attack-icon">
                </button>
            </div>
            <div>
                <input type="number" class="damage-input" placeholder="元ダメージ">
            </div>
            <div>
                <input type="number" class="barrier-input" placeholder="バリア量">
            </div>
            <div style="position: relative;">
                <input type="number" class="mitigated-damage-input" placeholder="軽減後">
                <div class="damage-tooltip"></div>
                <div class="mitigation-badge"></div>
                <button class="hp-reference-row-toggle" data-use-max="false" onclick="toggleRowHpReference(this)">
                <img src="ff14/ヒーラー.png" alt="ヒーラー" class="hp-toggle-icon"></button>
            </div>
            <div class="mute-drop-wrapper">
                <button class="row-mute-btn" data-muted="true" onclick="toggleRowMute(this)">
                    <span class="row-mute-icon" style="display: block;">🔇</span>
                    <span class="row-unmute-icon" style="display: none;">🔊</span>
                </button>
                <div class="voice-drop-zone"></div>
            </div>
        </div>
        <div class="timeline-skills-row">
            <div class="drop-zone">
                <button class="row-copy-btn" title="この行を複製" onclick="duplicateRow(this)">📋</button>
                <button class="row-discord-btn" title="この行をDiscord用にコピー" onclick="exportRowToDiscord(this)">💬</button>
            </div>
        </div>
    `;
    
    if (insertAfterRow) {
        const nextSibling = insertAfterRow.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('elapsed-time-display')) {
            timeline.insertBefore(elapsedDiv, nextSibling);
            timeline.insertBefore(row, nextSibling);
        } else {
            insertAfterRow.after(elapsedDiv);
            elapsedDiv.after(row);
        }
    } else {
        timeline.insertBefore(elapsedDiv, footerActions);
        timeline.insertBefore(row, footerActions);
    }
    
    setupRow(row);
    updateElapsedTimes();
    saveToLocalStorage();
    
    return row;
}

// 経過時間の表示を更新
function updateElapsedTimes() {
    const rows = document.querySelectorAll('.timeline-row');
    let prevSeconds = 0;
    
    rows.forEach((row, index) => {
        const timeInput = row.querySelector('.time-input');
        const currentSeconds = parseTime(timeInput.value);
        const elapsedSeconds = currentSeconds - prevSeconds;
        
        const prevSibling = row.previousElementSibling;
        if (prevSibling && prevSibling.classList.contains('elapsed-time-display')) {
            if (index === 0 || elapsedSeconds === 0) {
                prevSibling.style.display = 'none';
            } else {
                prevSibling.style.display = 'flex';
                prevSibling.textContent = `+${elapsedSeconds}秒`;
            }
        }
        
        prevSeconds = currentSeconds;
    });
}

// 行のイベント設定
function setupRow(row) {
    const dropZone = row.querySelector('.drop-zone');
    const damageInput = row.querySelector('.damage-input');
    const barrierInput = row.querySelector('.barrier-input');
    const mitigatedDamageInput = row.querySelector('.mitigated-damage-input');
    const timeInput = row.querySelector('.time-input');
    const attackTypeBtn = row.querySelector('.attack-type-btn');
    
    const wrapper = row.querySelector('.time-picker-wrapper');
    const dropdown = wrapper.querySelector('.time-picker-dropdown');
    const minutesScroll = dropdown.querySelector('.minutes-scroll');
    const secondsScroll = dropdown.querySelector('.seconds-scroll');
    
    for (let i = 0; i <= 20; i++) {
        const min = document.createElement('div');
        min.className = 'time-option';
        min.textContent = i;
        min.onclick = () => {
            const currentSeconds = parseInt(secondsScroll.querySelector('.selected')?.textContent || '0');
            timeInput.value = `${i}:${currentSeconds.toString().padStart(2, '0')}`;
            sortTimelineRows();
            updateElapsedTimes();
            recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
            saveToLocalStorage();
        };
        minutesScroll.appendChild(min);
    }
    
// 秒のボタンを生成（0～59秒、1秒刻み）
    for (let i = 0; i < 60; i++) { // ★ここを i++ に変更
        const sec = document.createElement('div');
        sec.className = 'time-option';
        
        // 数字を「01」「02」のように2桁で表示（見やすくなります！）
        sec.textContent = i.toString().padStart(2, '0');
        
        sec.onclick = () => {
            // ★ここが大事！今入力されている「分」を維持する処理
            const currentVal = timeInput.value.split(':');
            const currentMinutes = currentVal[0] || '0';
            
            timeInput.value = `${currentMinutes}:${i.toString().padStart(2, '0')}`;
            
            // 再計算と保存
            sortTimelineRows();
            updateElapsedTimes();
            recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
            saveToLocalStorage();
        };
        secondsScroll.appendChild(sec);
    }
    
    timeInput.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.querySelectorAll('.time-picker-dropdown').forEach(d => {
            if (d !== dropdown) d.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    timeInput.addEventListener('input', () => {
        sortTimelineRows();
        updateElapsedTimes();
        recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
        saveToLocalStorage();
    });

    timeInput.addEventListener('blur', (e) => {
        e.preventDefault();
    });

    let lastEditedField = null;

    attackTypeBtn.addEventListener('click', () => {
        const currentType = attackTypeBtn.dataset.type;
        let newType, newHTML, newClass;
        
        if (currentType === 'physical') {
            newType = 'magical';
            newHTML = '<img src="ff14/magical.png" alt="魔法" class="attack-icon">';
            newClass = 'magical-btn';
        } else if (currentType === 'magical') {
            newType = 'darkness';
            newHTML = '<img src="ff14/darkness.png" alt="闇" class="attack-icon">';
            newClass = 'darkness-btn';
        } else {
            newType = 'physical';
            newHTML = '<img src="ff14/physical.png" alt="物理" class="attack-icon">';
            newClass = 'physical-btn';
        }

        attackTypeBtn.dataset.type = newType;
        attackTypeBtn.innerHTML = newHTML;
        attackTypeBtn.className = 'attack-type-btn ' + newClass;
        recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, lastEditedField);
        saveToLocalStorage();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        
        if (data.requiresNsect === true || data.requiresNsect === 'true') {
            const currentSeconds = parseTime(timeInput.value);
            if (!canUseSunshine(currentSeconds)) {
                showNsectRequiredWarning(e.clientX, e.clientY);
                return;
            }
        }
        
        if (!canUseSkill(data.name, timeInput.value, row, data.skillGroup, data.jobName)) {
            showWarning(e.clientX, e.clientY);
            return;
        }
        
        addSkillToDropZone(dropZone, data, damageInput, barrierInput, mitigatedDamageInput, row, lastEditedField);
        
        if (data.enablesSunshine === true || data.enablesSunshine === 'true') {
            registerNsectPlacement(parseTime(timeInput.value), row);
        }
        
        if (data.needsNsectForBarrier === true || data.needsNsectForBarrier === 'true') {
            const currentSeconds = parseTime(timeInput.value);
            if (isConheliosInNsectRange(currentSeconds)) {
                data.barrierMultiplier = parseFloat(data.nsectBarrierMultiplier);
            }
        }
        
        if (data.barrierMultiplier && parseFloat(data.barrierMultiplier) > 0) {
            calculateAndAddBarrier(data, barrierInput);
            recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
        }
        
        if (data.duration && parseInt(data.duration) > 0) {
            applySkillToOtherRows(data, timeInput.value, row);
        }
        
        saveToLocalStorage();
    });

    [damageInput, barrierInput, mitigatedDamageInput, row.querySelector('.phase-input'), row.querySelector('.memo-input')].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                if (input === damageInput) lastEditedField = 'damage';
                if (input === mitigatedDamageInput) lastEditedField = 'mitigated';
                recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, lastEditedField);
                saveToLocalStorage();
            });
        }
    });
}

// スキルをドロップゾーンに追加
function addSkillToDropZone(dropZone, skill, damageInput, barrierInput, mitigatedDamageInput, row, lastEditedField, autoApplied = false) {
    const skillDiv = document.createElement('div');
    skillDiv.className = 'dropped-skill';
    
    if (skill.barrierMultiplier || skill.type === 'barrier') {
        skillDiv.classList.add('barrier-skill');
    }
    
    skillDiv.dataset.skillValue = skill.value || '';
    skillDiv.dataset.skillType = skill.type;
    skillDiv.dataset.skillName = skill.name;
    skillDiv.dataset.skillRecast = skill.recast;
    skillDiv.dataset.skillDuration = skill.duration || 0;
    if (skill.physicalValue) skillDiv.dataset.physicalValue = skill.physicalValue;
    if (skill.magicalValue) skillDiv.dataset.magicalValue = skill.magicalValue;
    if (skill.skillGroup) skillDiv.dataset.skillGroup = skill.skillGroup;
    if (skill.jobName) skillDiv.dataset.jobName = skill.jobName;
    if (skill.barrierType) skillDiv.dataset.barrierType = skill.barrierType;
    if (skill.barrierPercent) skillDiv.dataset.barrierPercent = skill.barrierPercent;
    if (skill.barrierMultiplier) skillDiv.dataset.barrierMultiplier = skill.barrierMultiplier;
    if (skill.barrierValue) skillDiv.dataset.barrierValue = skill.barrierValue;
    if (autoApplied) skillDiv.dataset.autoApplied = 'true';
    if (skill.sourceSkillId) skillDiv.dataset.sourceSkillId = skill.sourceSkillId;

    const skillContentDiv = document.createElement('div');
    skillContentDiv.className = 'skill-content';
    skillContentDiv.style.position = 'relative';
    skillContentDiv.style.width = '100%';
    skillContentDiv.style.height = '100%';

    if (skill.icon) {
        const img = document.createElement('img');
        img.src = skill.icon;
        img.alt = skill.name;
        img.style.width = '100%';
        img.style.height = '100%';
        skillContentDiv.appendChild(img);
    } else {
        const textSpan = document.createElement('span');
        textSpan.textContent = skill.name;
        skillContentDiv.appendChild(textSpan);
    }

    if (skill.jobName) {
        const jobIconDiv = document.createElement('div');
        jobIconDiv.className = 'job-icon-badge';
        jobIconDiv.title = skill.jobName;
        
        const jobData = findJobData(skill.jobName);
        if (jobData && jobData.icon) {
            const jobImg = document.createElement('img');
            jobImg.src = jobData.icon;
            jobImg.alt = skill.jobName;
            jobImg.style.width = '100%';
            jobImg.style.height = '100%';
            jobIconDiv.appendChild(jobImg);
        } else {
            jobIconDiv.textContent = skill.jobName.substring(0, 1);
        }
        skillContentDiv.appendChild(jobIconDiv);
    }
    
    if (skill.name === 'コンヘリ' && 
        (skill.needsNsectForBarrier === true || skill.needsNsectForBarrier === 'true') && 
        parseFloat(skill.barrierMultiplier) > 0) {
        const nsectIconDiv = document.createElement('div');
        nsectIconDiv.className = 'nsect-icon-badge';
        nsectIconDiv.title = 'Nセク効果中';
        
        const nsectImg = document.createElement('img');
        nsectImg.src = 'ff14/healer/占星/Nセク.png';
        nsectImg.alt = 'Nセク';
        nsectImg.style.width = '100%';
        nsectImg.style.height = '100%';
        nsectIconDiv.appendChild(nsectImg);
        skillContentDiv.appendChild(nsectIconDiv);
    }

    skillDiv.appendChild(skillContentDiv);

    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-skill';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
        if (skill.barrierMultiplier && parseFloat(skill.barrierMultiplier) > 0) {
            const barrierAmount = Math.floor(DEFAULT_RECOVERY_POWER * BARRIER_CONVERSION_RATE * parseFloat(skill.barrierMultiplier));
            const currentBarrier = parseFloat(barrierInput.value) || 0;
            barrierInput.value = Math.max(0, currentBarrier - barrierAmount);
        }
        
        if (skill.enablesSunshine === true || skill.enablesSunshine === 'true') {
            const timeInput = row.querySelector('.time-input');
            const rowTime = parseTime(timeInput.value);
            unregisterNsectPlacement(rowTime);
        }
        
        const sourceSkillId = skillDiv.dataset.sourceSkillId;
        if (!autoApplied && sourceSkillId) {
            removeLinkedAutoAppliedSkills(sourceSkillId, skill.name);
        }
        
        skillDiv.remove();
        recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
        updateSkillCount(dropZone);
        saveToLocalStorage();
    };

    skillDiv.appendChild(removeBtn);

    const dealtSkills = ['リプライザル(ナイト)', '牽制(モンク)', 'アドル(黒魔)', 'リプライザル(戦士)', 'リプライザル(暗黒)', 'リプライザル(ガンブレ)', '牽制(竜騎士)', '牽制(忍者)', '牽制(侍)', '牽制(リーパー)', '牽制(ヴァイパー)', 'アドル(召喚)', 'アドル(赤魔)', 'アドル(ピクト)'];
    const existingSkills = Array.from(dropZone.querySelectorAll('.dropped-skill'));

    let insertIndex = existingSkills.length;

    if (dealtSkills.includes(skill.name)) {
        insertIndex = 0;
        for (let i = 0; i < existingSkills.length; i++) {
            if (!dealtSkills.includes(existingSkills[i].dataset.skillName)) {
                insertIndex = i;
                break;
            }
        }
    }

    if (insertIndex >= existingSkills.length) {
        dropZone.appendChild(skillDiv);
    } else {
        dropZone.insertBefore(skillDiv, existingSkills[insertIndex]);
    }

    recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, lastEditedField);
    updateSkillCount(dropZone);
}

// ========================================
// timeline.js の updateSkillCount 関数をこれに置き換え
// ========================================

// スキル数のバッジ更新（軽減・バリアのみカウント）
function updateSkillCount(dropZone) {
    // まず置いてあるスキルを全部取得
    const allSkills = Array.from(dropZone.querySelectorAll('.dropped-skill'));
    const badge = dropZone.querySelector('.skill-count-badge');

    // ★ここで「軽減」か「バリア」の機能を持つものだけ選別（フィルター）します
    const mitigationSkills = allSkills.filter(skill => {
        const type = skill.dataset.skillType;

        // 1. バリア系判定
        // (バリア倍率がある、またはタイプがバリア関連)
        if (skill.dataset.barrierMultiplier || 
            skill.dataset.barrierType ||
            type === 'barrier' || 
            type === 'party-barrier' || 
            type === 'spread-barrier' || 
            type === 'buff-barrier') { // Nセクなど
            return true;
        }

        // 2. 軽減系判定
        // (タイプが軽減関連のリストに含まれているか)
        const mitigationTypes = [
            'taken',           // ランパ、カモフラなど
            'party-taken',     // 陣、ケーラ、サンサインなど
            'dealt',           // リプライザル、牽制、アドルなど
            'party-magic-taken', // イルミ、バマジクなど
            'magic',           // マインド、ダークミッショナリー
            'physical',        // 物理軽減
            'target',          // インタベ、コランダムなど
            'block',           // ブルワーク
            'immortal'         // 無敵
        ];

        if (mitigationTypes.includes(type)) {
            return true;
        }

        // 3. 個別に軽減値を持っている場合 (念のための判定)
        if (skill.dataset.physicalValue || skill.dataset.magicalValue) {
            return true;
        }

        // ここまで引っかからなかったもの（純粋なヒール、HoT、回復力アップバフなど）は除外
        return false;
    });

    // 選別した個数 (mitigationSkills.length) を使って表示
    if (mitigationSkills.length > 0) {
        if (!badge) {
            const newBadge = document.createElement('div');
            newBadge.className = 'skill-count-badge'; // CSSで指定した名前
            newBadge.textContent = mitigationSkills.length;
            dropZone.appendChild(newBadge);
        } else {
            badge.textContent = mitigationSkills.length;
            badge.style.display = 'flex'; // 表示する
        }
    } else {
        // 軽減・バリアが0個ならバッジを消す
        if (badge) badge.remove();
    }
}

// HP基準の切り替え
function toggleRowHpReference(button) {
    const useMax = button.dataset.useMax === 'true';
    button.dataset.useMax = !useMax;
    
    const icon = button.querySelector('.hp-toggle-icon');
    if (!useMax) {
        icon.src = 'ff14/タンク.png';
        icon.alt = 'タンク';
    } else {
        icon.src = 'ff14/ヒーラー.png';
        icon.alt = 'ヒーラー';
    }
    
    const row = button.closest('.timeline-row');
    const dropZone = row.querySelector('.drop-zone');
    const damageInput = row.querySelector('.damage-input');
    const barrierInput = row.querySelector('.barrier-input');
    const mitigatedDamageInput = row.querySelector('.mitigated-damage-input');
    
    recalculate(dropZone, damageInput, barrierInput, mitigatedDamageInput, row, null);
    saveToLocalStorage();
}

// 時間順にソート
function sortTimelineRows() {
    const timeline = document.getElementById('timeline');
    const rows = Array.from(document.querySelectorAll('.timeline-row'));
    const footerActions = timeline.querySelector('.timeline-footer-actions');
    
    rows.sort((a, b) => {
        const timeA = parseTime(a.querySelector('.time-input').value);
        const timeB = parseTime(b.querySelector('.time-input').value);
        return timeA - timeB;
    });
    
    rows.forEach(row => {
        const prevSibling = row.previousElementSibling;
        if (prevSibling && prevSibling.classList.contains('elapsed-time-display')) {
            timeline.insertBefore(prevSibling, footerActions);
        }
        timeline.insertBefore(row, footerActions);
    });
}

// ローカルストレージに保存
function saveToLocalStorage() {
    const rows = document.querySelectorAll('.timeline-row');
    const data = {
        minHp: document.getElementById('minHpInput')?.value || '',
        maxHp: document.getElementById('maxHpInput')?.value || '',
        rows: []
    };
    
    rows.forEach(row => {
        const rowData = {
            phase: row.querySelector('.phase-input').value,
            time: row.querySelector('.time-input').value,
            memo: row.querySelector('.memo-input').value,
            attackType: row.querySelector('.attack-type-btn').dataset.type,
            damage: row.querySelector('.damage-input').value,
            barrier: row.querySelector('.barrier-input').value,
            useMaxHp: row.querySelector('.hp-reference-row-toggle').dataset.useMax,
            muted: row.querySelector('.row-mute-btn').dataset.muted,
            skills: []
        };
        
        row.querySelectorAll('.dropped-skill').forEach(skill => {
            rowData.skills.push({
                name: skill.dataset.skillName,
                value: skill.dataset.skillValue,
                type: skill.dataset.skillType,
                physicalValue: skill.dataset.physicalValue,
                magicalValue: skill.dataset.magicalValue,
                skillGroup: skill.dataset.skillGroup,
                jobName: skill.dataset.jobName,
                barrierType: skill.dataset.barrierType,
                barrierPercent: skill.dataset.barrierPercent,
                barrierMultiplier: skill.dataset.barrierMultiplier,
                barrierValue: skill.dataset.barrierValue,
                autoApplied: skill.dataset.autoApplied,
                sourceSkillId: skill.dataset.sourceSkillId
            });
        });
        
        data.rows.push(rowData);
    });
    
    localStorage.setItem('ff14_mitigation_timeline', JSON.stringify(data));
}

// ローカルストレージから読み込み
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('ff14_mitigation_timeline');
    if (!savedData) return;

    const data = JSON.parse(savedData);

    if (data.minHp) document.getElementById('minHpInput').value = data.minHp;
    if (data.maxHp) document.getElementById('maxHpInput').value = data.maxHp;

    document.querySelectorAll('.timeline-row, .elapsed-time-display').forEach(el => el.remove());

    data.rows.forEach((rowData, index) => {
        const timeline = document.getElementById('timeline');
        
        const elapsedDiv = document.createElement('div');
        elapsedDiv.className = 'elapsed-time-display';
        
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        const attackTypeClass = rowData.attackType === 'magical' ? 'magical-btn' : 
                                rowData.attackType === 'darkness' ? 'darkness-btn' : 'physical-btn';
        const attackTypeImg = rowData.attackType === 'magical' ? 'magical' :
                             rowData.attackType === 'darkness' ? 'darkness' : 'physical';

        const useMaxHp = rowData.useMaxHp === 'true' ? 'true' : 'false';
        const hpIcon = useMaxHp === 'true' ? 'タンク' : 'ヒーラー';

        row.innerHTML = `
    <div class="timeline-info-row">
        <div>
            <input type="checkbox" class="row-checkbox" style="display: none;">
            <input type="text" class="phase-input" placeholder="フェーズ名" value="${rowData.phase || ''}">
        </div>
        <div class="time-picker-wrapper">
            <input type="text" class="time-input" placeholder="0:00" value="${rowData.time || ''}">
            <div class="time-picker-dropdown hidden">
                <div class="time-picker-scroll minutes-scroll"></div>
                <div class="time-picker-scroll seconds-scroll"></div>
            </div>
        </div>
        <div class="memo-container">
            <input type="text" class="memo-input" placeholder="メモ" value="${rowData.memo || ''}">
        </div>
        <div>
            <button class="attack-type-btn ${attackTypeClass}" data-type="${rowData.attackType || 'physical'}">
                <img src="ff14/${attackTypeImg}.png" alt="${attackTypeImg}" class="attack-icon">
            </button>
        </div>
        <div>
            <input type="number" class="damage-input" placeholder="元ダメージ" value="${rowData.damage || ''}">
        </div>
        <div>
            <input type="number" class="barrier-input" placeholder="バリア量" value="${rowData.barrier || ''}">
        </div>
        <div style="position: relative;">
            <input type="number" class="mitigated-damage-input" placeholder="軽減後">
            <div class="damage-tooltip"></div>
            <div class="mitigation-badge"></div>
            <button class="hp-reference-row-toggle" data-use-max="${useMaxHp}" onclick="toggleRowHpReference(this)">
                <img src="ff14/${hpIcon}.png" alt="${hpIcon}" class="hp-toggle-icon">
            </button>
        </div>
        <div class="mute-drop-wrapper">
            <button class="row-mute-btn" data-muted="${rowData.muted || 'true'}" onclick="toggleRowMute(this)">
                <span class="row-mute-icon" style="display: ${rowData.muted === 'false' ? 'none' : 'block'};">🔇</span>
                <span class="row-unmute-icon" style="display: ${rowData.muted === 'false' ? 'block' : 'none'};">🔊</span>
            </button>
            <div class="voice-drop-zone"></div>
        </div>
    </div>
    <div class="timeline-skills-row">
        <div class="label">軽減スキル</div>
        <div class="drop-zone">
            <button class="row-copy-btn" title="この行を複製" onclick="duplicateRow(this)">📋</button>
            <button class="row-discord-btn" title="この行をDiscord用にコピー" onclick="exportRowToDiscord(this)">💬</button>
        </div>
    </div>
`;

        timeline.insertBefore(elapsedDiv, timeline.querySelector('.timeline-footer-actions'));
        timeline.insertBefore(row, timeline.querySelector('.timeline-footer-actions'));
        setupRow(row);

        const dropZone = row.querySelector('.drop-zone');
        rowData.skills.forEach(skillData => {
            const skill = findSkillData(skillData.name);
            if (skill) {
                const fullSkillData = Object.assign({}, skill, skillData);
                addSkillToDropZone(dropZone, fullSkillData, 
                    row.querySelector('.damage-input'),
                    row.querySelector('.barrier-input'), 
                    row.querySelector('.mitigated-damage-input'),
                    row, null, skillData.autoApplied === 'true');
            }
        });

        recalculate(dropZone, 
            row.querySelector('.damage-input'),
            row.querySelector('.barrier-input'), 
            row.querySelector('.mitigated-damage-input'),
            row, null);
    });
    
    updateElapsedTimes();
}


// ========================================
// 削除メニューの切り替え（toggleMultiDelete を上書き）
// ========================================
function toggleMultiDelete() {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    const triggerBtn = document.getElementById('deleteTriggerBtn');
    const deleteMenu = document.getElementById('deleteMenu');
    
    // 現在の状態を判定（ボタンのクラス名で判定）
    const isDeleting = triggerBtn.classList.contains('active');
    
    // チェックボックスの表示切り替え
    checkboxes.forEach(cb => {
        cb.style.display = isDeleting ? 'none' : 'inline';
        cb.checked = false; // リセット
    });
    
    if (!isDeleting) {
        // 削除モードON
        triggerBtn.classList.add('active');
        triggerBtn.textContent = 'キャンセル';
        deleteMenu.style.display = 'flex'; // メニューを表示
    } else {
        // 削除モードOFF
        triggerBtn.classList.remove('active');
        triggerBtn.textContent = 'タイムライン削除';
        deleteMenu.style.display = 'none'; // メニューを隠す
    }
}

// ========================================
// カスタムモーダル制御関数（新規追加）
// ========================================

// モーダルを開く
function openDeleteModal() {
    const modal = document.getElementById('customDeleteModal');
    if (modal) {
        modal.classList.add('show'); // CSSでフェードイン
    }
}

// モーダルを閉じる
function closeDeleteModal() {
    const modal = document.getElementById('customDeleteModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 全削除の実行（モーダルの「削除する」ボタンから呼ばれる）
function executeDeleteAll() {
    // 全ての行と経過時間表示を削除
    const rows = document.querySelectorAll('.timeline-row');
    const elapsed = document.querySelectorAll('.elapsed-time-display');
    
    rows.forEach(el => el.remove());
    elapsed.forEach(el => el.remove());

    // 空の行を1つ追加してリセット
    addTimelineRow();
    
    // 状態を保存
    saveToLocalStorage();
    updateElapsedTimes();
    
    // モーダルを閉じて削除モードも終了
    closeDeleteModal();
    toggleMultiDelete(); // メニューを閉じて「タイムライン削除」に戻す
    
    // 通知
    if (typeof showNotification === 'function') {
        showNotification('タイムラインを全削除しました', 'success');
    }
}

// 警告表示
function showNsectRequiredWarning(x, y) {
    const warning = document.createElement('div');
    warning.className = 'nsect-warning';
    warning.innerHTML = '⚠️ Nセクの関係上、発動できません';
    warning.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: rgba(220, 53, 69, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        z-index: 99999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        white-space: nowrap;
    `;
    document.body.appendChild(warning);

    setTimeout(() => {
        warning.style.opacity = '0';
        warning.style.transition = 'opacity 0.3s';
        setTimeout(() => warning.remove(), 300);
    }, 2000);
}

function showWarning(x, y) {
    const warning = document.createElement('div');
    warning.className = 'recast-warning';
    warning.textContent = 'リキャストが戻っていません、または同じスキルが入っています';
    warning.style.left = (x + 10) + 'px';
    warning.style.top = (y + 10) + 'px';
    document.body.appendChild(warning);

    setTimeout(() => {
        warning.remove();
    }, 2000);
}

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', () => {
    const minHpInput = document.getElementById('minHpInput');
    if (minHpInput) {
        minHpInput.addEventListener('input', saveToLocalStorage);
    }

    const maxHpInput = document.getElementById('maxHpInput');
    if (maxHpInput) {
        maxHpInput.addEventListener('input', saveToLocalStorage);
    }

    const savedData = localStorage.getItem('ff14_mitigation_timeline');
    
    if (savedData) {
        loadFromLocalStorage();
    } else {
        const existingRows = document.querySelectorAll('.timeline-row');
        if (existingRows.length === 0) {
            addTimelineRow();
        }
    }
});


// ========================================
// 全削除機能 (timeline.js の末尾に追加)
// ========================================
function clearAllTimeline() {
    // 誤操作防止の確認ダイアログ
    if (!confirm('【警告】\nタイムラインを全て削除してもよろしいですか？\nこの操作は取り消せません。')) {
        return;
    }

    // すべての行と経過時間表示を削除
    const rows = document.querySelectorAll('.timeline-row');
    const elapsed = document.querySelectorAll('.elapsed-time-display');
    
    rows.forEach(el => el.remove());
    elapsed.forEach(el => el.remove());

    // 1行もないとバグるので、空の行を1つ追加しておく
    addTimelineRow();

    // データを保存して更新
    saveToLocalStorage();
    
    // 通知があれば表示
    if (typeof showNotification === 'function') {
        showNotification('タイムラインを全削除しました', 'success');
    }
}