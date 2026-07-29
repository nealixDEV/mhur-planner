(function () {
    var specialList = [];
    var normalTuningNames = [];

    function initTuningData() {
        specialList = [];
        normalTuningNames = [];
        if (window.SPECIAL_TUNING) {
            for (var i = 0; i < window.SPECIAL_TUNING.length; i++) {
                var st = window.SPECIAL_TUNING[i];
                if (st && st.skillName) {
                    specialList.push({ v: st.skillName, l: st.skillName });
                }
            }
        }
        if (window.NORMAL_TUNING) {
            var seen = {};
            for (var j = 0; j < window.NORMAL_TUNING.length; j++) {
                var nt = window.NORMAL_TUNING[j];
                if (nt) {
                    var charaName = nt.charaName || nt.characterName || '';
                    var eff = nt.effects || [];
                    var labelParts = [charaName];
                    for (var k = 0; k < eff.length; k++) {
                        labelParts.push(eff[k]);
                    }
                    var label = labelParts.join('|');
                    var role = nt.role || '';
                    if (!seen[label]) {
                        seen[label] = true;
                        normalTuningNames.push({ v: label, l: label, role: role });
                    }
                }
            }
        }
    }

    function getSpecialOptions() {
        var arr = [{ v: '', l: 'Any' }];
        for (var i = 0; i < specialList.length; i++) {
            arr.push(specialList[i]);
        }
        return arr;
    }

    function getNormalOptions() {
        return normalTuningNames;
    }

    function canEquipSpecial(cosSlot, ch, specName) {
        if (!specName) return true;
        var role = ch.role || ch.roleType || '';
        var align = ch.alignment || ch.align || '';
        var opts = window.specialOptions(role, null, align, null);
        if (!opts || !opts.length) return false;
        for (var i = 0; i < opts.length; i++) {
            if (opts[i] && opts[i].skillName === specName) return true;
        }
        return false;
    }

    function countTuningSlots(cos, tuningRole) {
        var count = 0;
        if (!cos || !cos.s) return count;
        for (var i = 0; i < cos.s.length; i++) {
            var slot = cos.s[i];
            if (slot && slot.role === tuningRole) count++;
        }
        return count;
    }

    function scoreCostume(cos, ch, filters) {
        var score = 0;
        var maxScore = 0;
        var used = 0;
        var wasted = 0;
        var leftScore = 0;
        var rightScore = 0;
        var tuningCounts = {};
        var leftFilter = filters.left || '';
        var rightFilter = filters.right || '';
        var normalFilters = filters.normal || [];

        if (!cos || !cos.s) return { score: 0, maxScore: 0, efficiency: 0, used: 0, wasted: 0, leftScore: 0, rightScore: 0, tuningCounts: {} };

        var role = ch.role || ch.roleType || '';
        var align = ch.alignment || ch.align || '';
        var specialOpts = window.specialOptions ? window.specialOptions(role, null, align, null) : [];

        for (var i = 0; i < cos.s.length; i++) {
            var slot = cos.s[i];
            if (!slot || !slot.role) continue;
            var tRole = slot.role;
            if (!tuningCounts[tRole]) tuningCounts[tRole] = 0;
            tuningCounts[tRole]++;

            var isSpecial = (slot.skillName && slot.skillName.length > 0);
            var slotMax = 10;
            maxScore += slotMax;

            if (isSpecial) {
                var matchesSpecial = false;
                if (slot.skillName === leftFilter || slot.skillName === rightFilter) {
                    matchesSpecial = true;
                }
                for (var s = 0; s < specialOpts.length; s++) {
                    if (specialOpts[s] && specialOpts[s].skillName === slot.skillName) {
                        matchesSpecial = true;
                        break;
                    }
                }
                if (matchesSpecial) {
                    score += slotMax;
                    used++;
                    if (slot.skillName === leftFilter) leftScore += slotMax;
                    if (slot.skillName === rightFilter) rightScore += slotMax;
                } else {
                    wasted++;
                }
            } else {
                var normalMatch = false;
                if (normalFilters.length === 0) {
                    normalMatch = true;
                } else {
                    for (var n = 0; n < normalFilters.length; n++) {
                        var nf = normalFilters[n];
                        if (!nf) continue;
                        if (slot.effects) {
                            var matched = true;
                            for (var e = 0; e < nf.length; e++) {
                                if (slot.effects.indexOf(nf[e]) === -1) {
                                    matched = false;
                                    break;
                                }
                            }
                            if (matched) {
                                normalMatch = true;
                                break;
                            }
                        }
                    }
                }
                if (normalMatch) {
                    score += slotMax;
                    used++;
                } else {
                    wasted++;
                }
            }
        }

        var efficiency = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return { score: score, maxScore: maxScore, efficiency: efficiency, used: used, wasted: wasted, leftScore: leftScore, rightScore: rightScore, tuningCounts: tuningCounts };
    }

    var roleIcons = {
        strike: 'https://raw.githubusercontent.com/HydrosPlays/ultrarumbleguide/refs/heads/main/images/strikebig.png',
        assault: 'https://raw.githubusercontent.com/HydrosPlays/ultrarumbleguide/refs/heads/main/images/assaultbig.png',
        rapid: 'https://raw.githubusercontent.com/HydrosPlays/ultrarumbleguide/refs/heads/main/images/rapidbig.png',
        technical: 'https://raw.githubusercontent.com/HydrosPlays/ultrarumbleguide/refs/heads/main/images/technicalbig.png',
        support: 'https://raw.githubusercontent.com/HydrosPlays/ultrarumbleguide/refs/heads/main/images/supportbig.png'
    };

    var roleColors = {
        strike: '#ef4444',
        assault: '#eab308',
        rapid: '#38bdf8',
        technical: '#a855f7',
        support: '#22c55e'
    };

    function customDropdown(opts, selectedVal, onChange) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;';

        var hidden = document.createElement('select');
        hidden.style.display = 'none';
        wrap.appendChild(hidden);

        var trigger = document.createElement('div');
        trigger.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:4px 8px;border:1px solid #555;border-radius:4px;background:#222;color:#fff;min-width:120px;justify-content:space-between;';
        trigger.textContent = '';
        var triggerSpan = document.createElement('span');
        triggerSpan.textContent = selectedVal || 'Any';
        var arrow = document.createElement('span');
        arrow.textContent = ' \u25BC';
        arrow.style.cssText = 'margin-left:4px;font-size:10px;';
        trigger.appendChild(triggerSpan);
        trigger.appendChild(arrow);
        wrap.appendChild(trigger);

        var popup = document.createElement('div');
        popup.style.cssText = 'position:absolute;top:100%;left:0;z-index:9999;background:#1a1a1a;border:1px solid #555;border-radius:4px;max-height:300px;overflow-y:auto;display:none;min-width:180px;';
        wrap.appendChild(popup);

        var optionItems = [];

        function buildOptions() {
            popup.innerHTML = '';
            optionItems = [];
            for (var i = 0; i < opts.length; i++) {
                var o = opts[i];
                var item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;padding:6px 8px;cursor:pointer;gap:6px;';
                item.style.borderBottom = '1px solid #333';

                var iconImg = document.createElement('img');
                iconImg.style.cssText = 'width:24px;height:24px;border-radius:4px;object-fit:contain;';
                if (o.icon) {
                    iconImg.src = o.icon;
                } else {
                    iconImg.style.display = 'none';
                }
                item.appendChild(iconImg);

                if (o.roleIcon) {
                    var roleImg = document.createElement('img');
                    roleImg.style.cssText = 'width:16px;height:16px;object-fit:contain;';
                    roleImg.src = o.roleIcon;
                    item.appendChild(roleImg);
                }

                var labelSpan = document.createElement('span');
                labelSpan.textContent = o.l;
                if (o.color) {
                    labelSpan.style.color = o.color;
                } else {
                    labelSpan.style.color = '#fff';
                }
                item.appendChild(labelSpan);

                item._label = o.l;
                item._val = o.v;
                optionItems.push(item);

                (function (val) {
                    item.addEventListener('click', function (e) {
                        e.stopPropagation();
                        set(val);
                        if (onChange) onChange(val);
                        popup.style.display = 'none';
                    });
                })(o.v);

                popup.appendChild(item);
            }
        }

        function set(val) {
            for (var i = 0; i < optionItems.length; i++) {
                if (optionItems[i]._val === val) {
                    triggerSpan.textContent = optionItems[i]._label;
                    hidden.value = val;
                    return;
                }
            }
            triggerSpan.textContent = val || 'Any';
            hidden.value = val || '';
        }

        function val() {
            return hidden.value;
        }

        buildOptions();

        var initialSet = false;
        for (var i = 0; i < optionItems.length; i++) {
            if (optionItems[i]._val === selectedVal) {
                triggerSpan.textContent = optionItems[i]._label;
                hidden.value = selectedVal;
                initialSet = true;
                break;
            }
        }
        if (!initialSet) {
            triggerSpan.textContent = 'Any';
            hidden.value = '';
        }

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (popup.style.display === 'none' || popup.style.display === '') {
                popup.style.display = 'block';
            } else {
                popup.style.display = 'none';
            }
        });

        function outsideClickHandler(e) {
            if (!wrap.contains(e.target)) {
                popup.style.display = 'none';
            }
        }
        document.addEventListener('click', outsideClickHandler);

        return { wrap: wrap, hidden: hidden, trigger: trigger, popup: popup, val: val, set: set };
    }

    function buildNormalTuningOptions() {
        var result = [];
        var seen = {};
        if (window.NORMAL_TUNING) {
            for (var i = 0; i < window.NORMAL_TUNING.length; i++) {
                var nt = window.NORMAL_TUNING[i];
                if (!nt) continue;
                var charaName = nt.charaName || nt.characterName || '';
                var eff = nt.effects || [];
                var labelParts = [charaName];
                for (var j = 0; j < eff.length; j++) {
                    labelParts.push(eff[j]);
                }
                var label = labelParts.join('|');
                var role = nt.role || '';
                if (!seen[label]) {
                    seen[label] = true;
                    result.push({ v: label, l: label, icon: null, roleIcon: roleIcons[role] || '', color: roleColors[role] || '#fff', role: role });
                }
            }
        }
        return result;
    }

    function buildAdvancedSearch(modal, ch, baseRender) {
        var toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Advanced Filters';
        toggleBtn.style.cssText = 'margin:8px;padding:6px 12px;cursor:pointer;background:#333;color:#fff;border:1px solid #555;border-radius:4px;';

        var panel = document.createElement('div');
        panel.style.cssText = 'display:none;padding:10px;background:#2a2a2a;border:1px solid #444;border-radius:4px;margin:8px;';

        var leftLabel = document.createElement('div');
        leftLabel.textContent = 'Left Special:';
        leftLabel.style.cssText = 'color:#fff;margin-bottom:4px;';

        var rightLabel = document.createElement('div');
        rightLabel.textContent = 'Right Special:';
        rightLabel.style.cssText = 'color:#fff;margin-bottom:4px;';

        var leftDD = customDropdown(getSpecialOptions(), '', function () {});
        var rightDD = customDropdown(getSpecialOptions(), '', function () {});

        var specialRow = document.createElement('div');
        specialRow.style.cssText = 'display:flex;gap:16px;margin-bottom:12px;';
        var leftCol = document.createElement('div');
        leftCol.appendChild(leftLabel);
        leftCol.appendChild(leftDD.wrap);
        var rightCol = document.createElement('div');
        rightCol.appendChild(rightLabel);
        rightCol.appendChild(rightDD.wrap);
        specialRow.appendChild(leftCol);
        specialRow.appendChild(rightCol);
        panel.appendChild(specialRow);

        var normalLabel = document.createElement('div');
        normalLabel.textContent = 'Normal Tuning Filters:';
        normalLabel.style.cssText = 'color:#fff;margin-bottom:4px;';

        var normalFiltersDiv = document.createElement('div');
        normalFiltersDiv.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:8px;';

        var normalOpts = buildNormalTuningOptions();
        var normalFilterList = [];

        function addNormalFilter() {
            var filterRow = document.createElement('div');
            filterRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

            var dd = customDropdown(normalOpts, '', function () {});
            var removeBtn = document.createElement('button');
            removeBtn.textContent = 'X';
            removeBtn.style.cssText = 'cursor:pointer;background:#c0392b;color:#fff;border:none;border-radius:3px;padding:2px 8px;';

            var tf = { dd: dd, row: filterRow, removeBtn: removeBtn };

            (function (tfObj) {
                removeBtn.addEventListener('click', function () {
                    normalFiltersDiv.removeChild(tfObj.row);
                    var idx = normalFilterList.indexOf(tfObj);
                    if (idx !== -1) normalFilterList.splice(idx, 1);
                });
            })(tf);

            filterRow.appendChild(dd.wrap);
            filterRow.appendChild(removeBtn);
            normalFiltersDiv.appendChild(filterRow);
            normalFilterList.push(tf);
        }

        var addFilterBtn = document.createElement('button');
        addFilterBtn.textContent = '+ Add Normal Filter';
        addFilterBtn.style.cssText = 'cursor:pointer;background:#27ae60;color:#fff;border:none;border-radius:3px;padding:4px 10px;margin-bottom:8px;';
        addFilterBtn.addEventListener('click', addNormalFilter);

        panel.appendChild(normalLabel);
        panel.appendChild(normalFiltersDiv);
        panel.appendChild(addFilterBtn);

        var debugLabel = document.createElement('div');
        debugLabel.textContent = 'Pass: 0';
        debugLabel.style.cssText = 'color:#aaa;margin-bottom:8px;font-size:12px;';
        panel.appendChild(debugLabel);

        var applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = 'cursor:pointer;background:#3498db;color:#fff;border:none;border-radius:3px;padding:6px 16px;margin-right:8px;';

        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.cssText = 'cursor:pointer;background:#666;color:#fff;border:none;border-radius:3px;padding:6px 16px;';

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';
        btnRow.appendChild(applyBtn);
        btnRow.appendChild(resetBtn);
        panel.appendChild(btnRow);

        var inserted = false;

        toggleBtn.addEventListener('click', function () {
            if (panel.style.display === 'none' || panel.style.display === '') {
                panel.style.display = 'block';
                if (!inserted) {
                    initTuningData();
                    var body = modal.querySelector('.cos-modal-body');
                    if (body && body.parentNode) {
                        body.parentNode.insertBefore(panel, body);
                    } else {
                        modal.appendChild(panel);
                    }
                    inserted = true;
                }
            } else {
                panel.style.display = 'none';
            }
        });

        applyBtn.addEventListener('click', function () {
            var leftVal = leftDD.val();
            var rightVal = rightDD.val();
            var normalFilters = [];
            for (var i = 0; i < normalFilterList.length; i++) {
                var nv = normalFilterList[i].dd.val();
                if (nv) {
                    var parts = nv.split('|');
                    var effects = parts.slice(1);
                    normalFilters.push(effects);
                }
            }

            window.__advSearchFilters = { left: leftVal, right: rightVal, normal: normalFilters };

            var costumes = [];
            if (ch && ch.costumes) {
                costumes = ch.costumes;
            } else if (window.__costumeData) {
                costumes = window.__costumeData;
            }

            var results = [];
            for (var c = 0; c < costumes.length; c++) {
                var cos = costumes[c];
                if (!cos) continue;
                var s = scoreCostume(cos, ch, window.__advSearchFilters);
                if (s.score > 0 || (leftVal === '' && rightVal === '' && normalFilters.length === 0)) {
                    results.push({ costume: cos, score: s });
                }
            }

            results.sort(function (a, b) {
                return b.score.score - a.score.score;
            });

            window.__advSearchResults = results;
            debugLabel.textContent = 'Pass: ' + results.length;
            if (baseRender) baseRender();
        });

        resetBtn.addEventListener('click', function () {
            leftDD.set('');
            rightDD.set('');
            while (normalFilterList.length > 0) {
                var tf = normalFilterList[0];
                normalFiltersDiv.removeChild(tf.row);
                normalFilterList.splice(0, 1);
            }
            window.__advSearchResults = [];
            window.__advSearchFilters = { left: '', right: '', normal: [] };
            debugLabel.textContent = 'Pass: 0';
            if (baseRender) baseRender();
        });

        modal.insertBefore(toggleBtn, modal.firstChild);
    }

    window.advSearchBuild = buildAdvancedSearch;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initTuningData();
        });
    } else {
        initTuningData();
    }
})();
