/* ==========================================================================
   FATEFUL QR - APPLICATION ENGINE (app.js)
   ========================================================================== */

// Preload the fortunetellers image for Canvas certificate and avatar loading
const membersImg = new Image();
membersImg.src = 'assets/members.jpg';

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // UI Elements
    // ----------------------------------------------------------------------
    const panels = {
        input: document.getElementById('step-input'),
        analyze: document.getElementById('step-analyze'),
        deliberation: document.getElementById('step-deliberation'),
        result: document.getElementById('step-result')
    };

    const birthYearEl = document.getElementById('birth-year');
    const birthMonthEl = document.getElementById('birth-month');
    const birthDayEl = document.getElementById('birth-day');

    function getSelectedBirthDate() {
        if (!birthYearEl || !birthMonthEl || !birthDayEl) return "1995-01-01";
        const y = birthYearEl.value;
        const m = birthMonthEl.value.padStart(2, '0');
        const d = birthDayEl.value.padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const qrReaderEl = document.getElementById('qr-reader');
    const scanPlaceholder = document.getElementById('scan-placeholder');
    const fileUpload = document.getElementById('file-upload');
    
    // Buttons
    const btnStartScan = document.getElementById('btn-start-scan');
    const btnStopScan = document.getElementById('btn-stop-scan');
    const btnMockScan = document.getElementById('btn-mock-scan');
    const btnProceedJudge = document.getElementById('btn-proceed-judge');
    const btnRetryInput = document.getElementById('btn-retry-input');
    const btnStartDeliberate = document.getElementById('btn-start-deliberate');
    const btnGoResult = document.getElementById('btn-go-result');
    const btnDownloadCert = document.getElementById('btn-download-cert');
    const btnShareSns = document.getElementById('btn-share-sns');
    const btnRestart = document.getElementById('btn-restart');

    // Result UI Elements
    const tallyCountEl = document.getElementById('tally-count');
    const verdictBanner = document.getElementById('verdict-banner');
    const chairpersonCommentEl = document.getElementById('chairperson-comment');
    const chairpersonNameEl = document.getElementById('chairperson-name');
    const chairpersonAvatarEl = document.getElementById('chairperson-avatar');
    const certCanvas = document.getElementById('cert-canvas');

    // ----------------------------------------------------------------------
    // Audio Synthesizer (Web Audio API)
    // ----------------------------------------------------------------------
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Tick sound (Clock)
    function playTick() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.06);
    }

    // Taiko drum sound (Verdict announcement for Kyo/Bad)
    function playTaiko() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.35);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(75, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

        osc.start();
        osc2.start();
        osc.stop(audioCtx.currentTime + 0.5);
        osc2.stop(audioCtx.currentTime + 0.5);
    }

    // Stamp crash sound (Final impact / Thunder)
    function playStampCrash() {
        if (!audioCtx) return;
        
        // Low impact tone
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.8);
        
        // White Noise for explosion
        const bufferSize = audioCtx.sampleRate * 1.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        // Lowpass filter for noise
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, audioCtx.currentTime);
        filter.Q.setValueAtTime(5, audioCtx.currentTime);
        
        const noiseGain = audioCtx.createGain();
        
        osc.connect(gain);
        noise.connect(filter);
        filter.connect(noiseGain);
        
        gain.connect(audioCtx.destination);
        noiseGain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
        
        noiseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.0);
        
        osc.start();
        noise.start();
        osc.stop(audioCtx.currentTime + 1.0);
        noise.stop(audioCtx.currentTime + 1.0);
    }

    // Bright chime sound for Good/Excellent vote (deliberation)
    function playChimeSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now); // B5
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now); // E6
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
    }

    // Fanfare for final Good/Excellent verdict
    function playFanfareSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = [587.33, 659.25, 880.00, 1174.66]; // D5, E5, A5, D6
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            const noteStart = now + idx * 0.1;
            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.linearRampToValueAtTime(0.15, noteStart + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.5);
            
            osc.start(noteStart);
            osc.stop(noteStart + 0.55);
        });
    }

    // ----------------------------------------------------------------------
    // State Variables
    // ----------------------------------------------------------------------
    let html5Qrcode = null;
    let selectedBirthDate = "";
    let scannedBarcode = "";
    let todayDateStr = "";
    let finalVerdict = ""; // "DAIKICHI", "KICHI", or "KYO"
    let finalTally = { daikichi: 0, kichi: 0, kyo: 0 };
    let selectedComments = [];
    let chairpersonIdx = 0;
    let chairpersonComment = "";

    // ----------------------------------------------------------------------
    // PANEL NAVIGATION
    // ----------------------------------------------------------------------
    function showPanel(panelName) {
        Object.keys(panels).forEach(name => {
            if (name === panelName) {
                panels[name].classList.add('active');
            } else {
                panels[name].classList.remove('active');
            }
        });
        window.scrollTo(0, 0);
    }

    // Populate Birthdate Selects (Year: 1950-current, Month: 1-12, Day: 1-31)
    if (birthYearEl && birthMonthEl && birthDayEl) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= 1950; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === 1995) opt.selected = true; // Default to 1995
            birthYearEl.appendChild(opt);
        }
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            if (m === 1) opt.selected = true;
            birthMonthEl.appendChild(opt);
        }
        for (let d = 1; d <= 31; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            if (d === 1) opt.selected = true;
            birthDayEl.appendChild(opt);
        }

        // Keep days in month accurate (leap years, etc.)
        function updateDays() {
            const year = parseInt(birthYearEl.value);
            const month = parseInt(birthMonthEl.value);
            const daysInMonth = new Date(year, month, 0).getDate();
            const currentSelectedDay = parseInt(birthDayEl.value) || 1;

            birthDayEl.innerHTML = '';
            for (let d = 1; d <= daysInMonth; d++) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                if (d === currentSelectedDay || (d === daysInMonth && currentSelectedDay > daysInMonth)) {
                    opt.selected = true;
                }
                birthDayEl.appendChild(opt);
            }
        }
        birthYearEl.addEventListener('change', updateDays);
        birthMonthEl.addEventListener('change', updateDays);
        updateDays();
    }

    // ----------------------------------------------------------------------
    // BARCODE SCANNING CONTROL (html5-qrcode)
    // ----------------------------------------------------------------------
    async function startScanner() {
        initAudio();
        selectedBirthDate = getSelectedBirthDate();

        qrReaderEl.classList.remove('hidden');
        scanPlaceholder.classList.add('hidden');
        btnStartScan.classList.add('hidden');
        btnStopScan.classList.remove('hidden');

        if (!html5Qrcode) {
            html5Qrcode = new Html5Qrcode("qr-reader", {
                useBarCodeDetectorIfSupported: false,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: false
                },
                verbose: false
            });
        }

        const config = {
            fps: 15,
            qrbox: (width, height) => {
                // A square box fits both QR codes and EAN-13 barcodes comfortably
                const size = Math.min(width * 0.8, height * 0.8, 280);
                return { width: size, height: size };
            },
            aspectRatio: 1.333333,
            useBarCodeDetectorIfSupported: false,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
            },
            videoConstraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
                aspectRatio: { ideal: 1.333333 }
            }
        };

        async function applyDynamicCameraConstraints() {
            try {
                if (!html5Qrcode) return;
                const capabilities = html5Qrcode.getRunningTrackCapabilities();
                const settings = html5Qrcode.getRunningTrackSettings();
                console.log("Camera capabilities:", capabilities);
                console.log("Camera settings:", settings);

                const constraints = {};
                let hasAdvanced = false;
                const advancedConstraint = {};

                // Apply minor zoom (e.g. 1.2x) if supported to help the camera focus on the code
                if (capabilities.zoom) {
                    const idealZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, 1.2));
                    advancedConstraint.zoom = idealZoom;
                    hasAdvanced = true;
                    console.log(`Setting zoom to: ${idealZoom}`);
                }

                if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
                    constraints.focusMode = "continuous";
                    console.log("Setting focusMode to continuous");
                }

                if (hasAdvanced) {
                    constraints.advanced = [advancedConstraint];
                }

                if (Object.keys(constraints).length > 0) {
                    await html5Qrcode.applyVideoConstraints(constraints);
                    console.log("Applied dynamic video constraints successfully");
                }
            } catch (constrErr) {
                console.warn("Could not apply dynamic video constraints:", constrErr);
            }
        }

        try {
            // Attempt start with HD video constraints
            await html5Qrcode.start(
                { facingMode: "environment" },
                config,
                (decodedText, decodedResult) => {
                    scannedBarcode = decodedText;
                    stopScanner();
                    proceedToAnalysis();
                },
                (errorMessage) => {
                    // Ignore errors during continuous scan frames
                }
            );
            await applyDynamicCameraConstraints();
        } catch (err) {
            console.warn("First camera start failed, retrying with fallback constraints:", err);
            try {
                // Fallback attempt: request simple environment camera without any strict resolution constraints
                await html5Qrcode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        aspectRatio: 1.333333,
                        useBarCodeDetectorIfSupported: false,
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: false
                        },
                        qrbox: (width, height) => {
                            const size = Math.min(width * 0.8, height * 0.8, 280);
                            return { width: size, height: size };
                        },
                        videoConstraints: {
                            facingMode: "environment",
                            aspectRatio: { ideal: 1.333333 }
                        }
                    },
                    (decodedText, decodedResult) => {
                        scannedBarcode = decodedText;
                        stopScanner();
                        proceedToAnalysis();
                    },
                    (errorMessage) => {
                        // Ignore errors
                    }
                );
                await applyDynamicCameraConstraints();
            } catch (fallbackErr) {
                console.error("Camera scan start failed completely:", fallbackErr);
                alert("カメラの起動に失敗しました。カメラの使用許可設定を確認するか、ファイルアップロードをご利用ください。");
                stopScanner();
            }
        }
    }

    function stopScanner() {
        if (html5Qrcode && html5Qrcode.isScanning) {
            html5Qrcode.stop().then(() => {
                qrReaderEl.classList.add('hidden');
                scanPlaceholder.classList.remove('hidden');
                btnStartScan.classList.remove('hidden');
                btnStopScan.classList.add('hidden');
            }).catch(err => {
                console.error("Failed to stop scanner:", err);
            });
        } else {
            qrReaderEl.classList.add('hidden');
            scanPlaceholder.classList.remove('hidden');
            btnStartScan.classList.remove('hidden');
            btnStopScan.classList.add('hidden');
        }
    }

    fileUpload.addEventListener('change', async (e) => {
        initAudio();
        selectedBirthDate = getSelectedBirthDate();

        const file = e.target.files[0];
        if (!file) return;

        stopScanner();

        if (!html5Qrcode) {
            html5Qrcode = new Html5Qrcode("qr-reader");
        }

        showPanel('analyze');
        const progressFill = document.getElementById('analyze-progress');
        const progressText = document.getElementById('analyze-text');
        const resultPanel = document.getElementById('analyze-result-panel');
        resultPanel.classList.add('hidden');
        progressFill.style.width = '20%';
        progressText.innerText = '画像をアップロード中...';

        setTimeout(async () => {
            try {
                progressFill.style.width = '60%';
                progressText.innerText = 'バーコードのパターンを検出中...';
                
                const decodedText = await html5Qrcode.scanFile(file);
                scannedBarcode = decodedText;
                
                progressFill.style.width = '100%';
                progressText.innerText = '解析成功！';
                finishAnalysis();
            } catch (err) {
                console.warn("File QR scan failed, using simulated code based on file metadata:", err);
                const fakeCode = "49" + Math.abs(getHashCode(file.name + file.size)).toString().substring(0, 11);
                scannedBarcode = fakeCode;
                
                progressFill.style.width = '100%';
                progressText.innerText = '解析成功（パターン抽出）';
                finishAnalysis();
            }
        }, 800);
    });

    btnMockScan.addEventListener('click', () => {
        initAudio();
        selectedBirthDate = getSelectedBirthDate();

        const randomDigits = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        scannedBarcode = "49" + randomDigits.substring(0, 11);

        stopScanner();
        proceedToAnalysis();
    });

    btnStartScan.addEventListener('click', startScanner);
    btnStopScan.addEventListener('click', stopScanner);

    // ----------------------------------------------------------------------
    // STEP 2: ANALYSIS AND SEED CALCULATION
    // ----------------------------------------------------------------------
    function proceedToAnalysis() {
        showPanel('analyze');
        
        const progressFill = document.getElementById('analyze-progress');
        const progressText = document.getElementById('analyze-text');
        const resultPanel = document.getElementById('analyze-result-panel');
        resultPanel.classList.add('hidden');

        progressFill.style.width = '0%';
        progressText.innerText = 'バーコードデータを読み取り中...';

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            progressFill.style.width = `${progress}%`;

            if (progress === 30) {
                progressText.innerText = '生年月日との運命結合係数を計算中...';
            }
            if (progress === 60) {
                progressText.innerText = '現在日付とのアラインメントを同期中...';
            }
            if (progress === 90) {
                progressText.innerText = '占術シードを生成中...';
            }

            if (progress >= 100) {
                clearInterval(interval);
                finishAnalysis();
            }
        }, 150);
    }

    function finishAnalysis() {
        const resultPanel = document.getElementById('analyze-result-panel');
        const resultDetails = document.getElementById('analyze-result-details');
        
        const maskedBarcode = scannedBarcode.substring(0, 4) + "********" + scannedBarcode.substring(scannedBarcode.length - 2);
        const birthYear = selectedBirthDate.split("-")[0];
        
        resultDetails.innerHTML = `
            運命波形の同調に成功しました。<br>
            <span style="color: var(--color-gold); font-weight: bold;">バーコード種別: ${scannedBarcode.length > 10 ? 'JAN/EAN-13' : 'QR-Code'}</span><br>
            <span style="font-size: 12px; color: var(--color-text-muted);">
                ターゲット: ${birthYear}年生まれ / 識別子: ${maskedBarcode}
            </span>
        `;
        resultPanel.classList.remove('hidden');
    }

    btnProceedJudge.addEventListener('click', () => {
        showPanel('deliberation');
        resetDeliberationUI();
    });

    btnRetryInput.addEventListener('click', () => {
        showPanel('input');
        fileUpload.value = '';
    });

    // ----------------------------------------------------------------------
    // STAGE 3: FORTUNETELLERS DELIBERATION DATA
    // ----------------------------------------------------------------------
    const fortunetellersData = [
        {
            name: "古代のシャーマン",
            title: "精霊と自然の交信者",
            daikichi: [
                "おお、精霊たちが激しく踊っているわ！ 今日のあなたは太陽の大いなる恵みを受ける。狩りに出るなら今日ね！",
                "大地が歓喜の歌を歌っている！ 何をやっても獲物が向こうから飛び込んでくるような、生命力に満ちあふれた一日よ！",
                "大精霊があなたの頭上で七色の光を放っているわ！ 今日はどんな強敵に立ち向かっても、勝利の雄叫びをあげることになるでしょう！",
                "森の奥深くから黄金の泉が湧き出たわ！ あなたの魂が光り輝いている。今すぐ心躍る冒険へ出発するのよ！"
            ],
            kichi: [
                "川の流れは穏やか、木の実も豊作よ。いつも通り焦らず、大地を踏みしめて進むといいわ。",
                "風は穏やかに吹き、森は静かに囁いている。奇をてらわず、自然の導きに身を任せるのが吉ね。",
                "大樹の木陰が心地よいわ。焦ることはない、風に揺られる葉のように、静かに呼吸を整えて過ごしなさい。",
                "月が静かに満ちていく。今すぐ劇的な変化はないけれど、あなたの歩みは確実に実りへと向かっているわ。"
            ],
            kyo: [
                "む、風の噂で不穏な気配……。今日は無理に外へ出ず、洞窟の中で火を囲んで静かに休むのよ。",
                "精霊たちがそっぽを向いているわ。大岩の下に身を隠し、嵐が通り過ぎるのをじっと待つのが賢い選択よ。",
                "む、精霊たちの声がザワついている…。今日は大風が吹く予感。無理に山を登らず、足元をしっかり見て歩きなさい。",
                "川の主が深く眠りについてしまったわ。今日は余計な手出しをせず、静かに干し肉でもかじって体力を蓄えるのよ。"
            ],
            thinking: [
                "精霊たちの声を聴くわ…",
                "大地の鼓動を感じ取らねば…",
                "風の精霊よ、何を囁いているの？"
            ],
            summary: {
                daikichi: "精霊たちの祝福の歌が聞こえるわ！ 今日のあなたの運気は太陽よりも力強い。恐れるものは何もない、突き進みなさい！",
                kichi: "川は流れ、草木は育つ。大地の恵みはあなたと共にあるわ。平凡な一日こそ、自然からの最高の贈り物よ。",
                kyo: "嵐の予兆ね。こういう日は無理に獲物を追ってはならないわ。洞窟を温め、明日の日の出を静かに待ちましょう。"
            }
        },
        {
            name: "中世の魔女",
            title: "見習い魔法調合師",
            daikichi: [
                "わあ、水晶玉がピカピカに輝いてる！今日のあなたは無敵の魔法にかかってます！美味しいお菓子を食べるとさらに運気アップ⭐",
                "大成功の魔法陣が描けたよ！今日のあなたは無敵ハッピー！スキップでお出かけしちゃってね！",
                "すごーい！星たちの配置がパーフェクト！今日のあなたは超ラッキーな大魔法使いになれちゃうかも⭐",
                "調合したポーションから虹色の煙が出たよ！奇跡レベルの大成功！今日は何をお願いしても叶っちゃう気がする！"
            ],
            kichi: [
                "あ、大吉です！……あ、ごめんなさい、ちょっと見間違えちゃう、普通の吉です！でも、じゅうぶんハッピーな一日になりますよ！",
                "水晶玉はまあまあクリアね！特別な奇跡はないけれど、おいしいパンを焼いて食べるとプチ幸せが見つかったよ！",
                "水晶玉には…うん、穏やかな青空が映ってる！大きな波乱はないけど、猫をなでるといいことがあるかも？",
                "タロットカードは『コインのページ』！ちょっとしたお小遣いが入るか、おいしいおやつがもらえる予感だよ⭐"
            ],
            kyo: [
                "ひゃわわ！怪しい特製ポーションをひっくり返しちゃった……！今日は予想外のハプニングに気をつけて、お守りを持って出かけてね！",
                "あわわ、ホウキの柄がポッキリ折れちゃった！操作ミスに気をつけて、箒のメンテナンスを忘れないでね！",
                "ひゃわ！ホウキに乗ってたら木に引っかかっちゃった！今日はあわてず、目の前の障害物に注意して進んでね…！",
                "あわわ、タロットカードを逆さまに引いちゃった！今日は忘れ物に気をつけて、お家を出る前に戸締まりを確認してね！"
            ],
            thinking: [
                "水晶玉よ、未来を映して〜！",
                "えーっと、星の配置がちょっと急変したかも？",
                "タロットカードさん、ヒントをちょうだい！"
            ],
            summary: {
                daikichi: "星たちが今日一番の祝福をささやいてるわ！奇跡の魔法があなたを包んでいるから、やりたいことは全部叶っちゃうかも！",
                kichi: "特別な魔法はないけれど、お日様の光が温かい一日よ。お気に入りのハーブティーでも飲んで、のんびりハッピーに過ごしましょう！",
                kyo: "あわわ、タロットカードが風で飛んでいっちゃった！でも心配しないで、今日はちょっとだけ逆境に気をつければ大丈夫だからね！"
            }
        },
        {
            name: "日本の神主",
            title: "八百万の神のメッセンジャー",
            daikichi: [
                "おお、神々の大いなる御加護を感じます！ 目の前の霧が晴れ渡るような、極めて瑞々しく晴れやかな一日となるでしょう。",
                "神風があなたの背中を力強く押しています！ 何事も順調に進み、大きな慶びが訪れる、そんなめでたき日の到来です。",
                "これはこれは！八百万の神々が満面の笑みで集っておられます！今日のあなたの行く手には、無数の幸運の花が咲き乱れることでしょう。",
                "心願成就の兆し！本日は何事も神々の思し召しのままに、極めて円滑に、安定して成果へと結びつく吉日でございます。"
            ],
            kichi: [
                "平穏無事。昨日と変わらぬ穏やかな朝を迎えられたことこそ、最大の祝福。静かに感謝を捧げ、日々を営みましょう。",
                "神々の足並みも綺麗に揃っております。大きな波風は立ちませんが、水面が静かに輝くような、穏やかで良い一日です。",
                "神前を掃き清めるような、清々しく落ち着いた空気です。目立った出来事はなくとも、心静かに過ごせる良き一日となりましょう。",
                "風鈴が優しく鳴っております。神々もあなたの日常を静かに見守っておられますゆえ、いつも通りに誠実に過ごせば吉です。"
            ],
            kyo: [
                "ふむ、少々雲行きが怪しいようです。このような日は無理に動かず、境内を清めるように、身の回りの整理に努めましょう。",
                "どうやら風の通りが少し滞っている様子。無理をして外へ飛び出すより、社殿の雨宿りで機が熟すのを待つのが賢明です。",
                "おやおや、お供え物の団子を野鳥に突っつかれてしまいました。本日は不意の小難があるやもしめます。用心して過ごしませう。",
                "雲が太陽を遮り、境内が少し肌寒く感じられます。今日は大きな決断は避け、温かいお茶でも飲んで静養なさるのが賢明です。"
            ],
            thinking: [
                "神々のご意思をお伺いいたします。",
                "神聖なる風の流れを感じ取らねば…",
                "祝詞を奏上し、心を研ぎ澄まします。"
            ],
            summary: {
                daikichi: "実に素晴らしいご神託です！ 大鳥居をくぐるような清々しい風が吹く一日。全ての災いが祓われ、福が舞い込むでしょう。",
                kichi: "平穏にして無事。変わらぬ日々に感謝を捧げ、丁寧にお過ごしください。足元の石につまずかぬよう、それだけを心に留めておけば十分です。",
                kyo: "神々も静寂を求めておられるようです。無理に事を起こせば風が乱れます。今日は大人しく、日頃の感謝を口にするだけで吉へと転じましょう。"
            }
        },
        {
            name: "現代のコンサルタント",
            title: "データとトレンドの解析屋",
            daikichi: [
                "おめでとうございます、今日のあなたの運気は完全に『右肩上がりの成長トレンド』です。すべてのタスクが爆速で片付くでしょう。コミットのチャンスです！",
                "素晴らしいレバレッジがかかっています。今日のあなたはROI（投資対効果）が最大化されるフェーズ。大胆に提案を出すべきです！",
                "素晴らしいアウトプットです！今日のあなたのパフォーマンスは競合他社を圧倒するレベル。全ての交渉でイニシアチブを取れます。",
                "市場の成長率とあなたのポテンシャルが完全にシナジーを生んでいます。まさに『ブルーオーシャン』。爆速でスケールしましょう！"
            ],
            kichi: [
                "現状維持、つまり安定軌道です。リスクヘッジを意識しつつ、いつものルーティンを確実にこなせば、及第点の成果が得られる一日になります。",
                "リソースのバランスは取れています。本日は無茶な新規開拓は避け、既存業務のクオリティ最適化に時間を使うべきですね。",
                "安定したKPIを維持しています。本日はイレギュラーな対応は避け、既存業務の定常運転（BAU）にコミットしてください。",
                "リソースの無駄遣い（ムダ）がなく、非常にリーンな状態です。大きなジャンプはありませんが、着実にマイルストーンを達成できます。"
            ],
            kyo: [
                "現在、運気メーターが一時的なベアマーケット（下落相場）に突入中。今日は新規の投資や無茶な挑戦は避け、損切りとパワーナップ（昼寝）に徹してください。",
                "注意！作業効率のボトルネックを検知しました。無理に進行させると手戻りが発生します。タスクを一時サスペンドし、休息を取るのが合理判断です。",
                "警告：一時的なサーバーダウン、またはタスクの遅延リスク（ボトルネック）が発生しやすくなっています。防衛的アライアンスを推奨します。",
                "現在の運気は『踊り場』。無理にドライブするとROIが悪化します。本日はタスクの棚卸しと、リフレッシュにリソースを充ててください。"
            ],
            thinking: [
                "データトレンドをロード中…",
                "このパラメータ、相関性が極めて高いですね。",
                "期待値のシミュレーションを実行します。"
            ],
            summary: {
                daikichi: "素晴らしいパフォーマンスを発揮できる一日です。KPIはすべて超過達成の予測。ボトルネックは解消されました。自信を持ってドライブしてください。",
                kichi: "標準的なオペレーションに問題はありません。今日の重要課題は『現状の確実な維持』です。無理なスケールアップは避け、足固めを推奨します。",
                kyo: "市場環境は厳しいと判断します。リソースの消耗を防ぐため、本日は防衛的ポートフォリオを組み、早めのタスククローズと休息にリソースを配分してください。"
            }
        },
        {
            name: "未来のロボット",
            title: "時空超越AIモジュール",
            daikichi: [
                "ピピッ……エラー：超強運状態を検知。今日のあなたのラッキー確率は 99.9% です。エネルギー満タン。全システム、オールグリーン！",
                "ブォン……量子コンピューティング予測：最高効率のルートを検出完了。障害物存在確率 0.00%。加速プロセスへ移行します！",
                "確率演算完了：本日のあなたのラッキー係数は理論上最大値の999%に達しました。リミッターを解除し、前進あるのみ！",
                "システムより通知：周囲のすべての環境オブジェクトがあなたに好意的なイベントを生成しています。完全勝利モード起動！"
            ],
            kichi: [
                "システム正常稼働中。アップデートは順調です。予測される一日の満足度は『概ね良好』。通常モードで出撃してください。",
                "ステータス：標準。リソース使用効率 50% を維持。イレギュラーな命令がなければ、快適な日常タスクが完遂されます。",
                "平穏なデータを観測。目立った乱れはありません。いつも通りのアップデートを行い、堅実に過ごしてください。",
                "周囲の波動は標準値内。お気に入りのエネルギー（カフェイン等）を補給すると、生産性が12%向上するでしょう。"
            ],
            kyo: [
                "404 Not Found。占いに必要なデータが破損、または存在しません。……冗談です。今日の運気は少し省エネモード。早めのシャットダウンを推奨します。",
                "警告：回路のオーバーヒートを検知。本日はプロセッサーの稼働率を30%以下にセーブし、スリーププロトコルを多めに挿入してください。",
                "ピーッ！一時的な量子ノイズの上昇を検出。今日は無茶なオーバークロック（挑戦）を避け、スリープモードで過ごしましょう。",
                "警告：不確定エラーを検知。歩行時の足元スキャンを怠らないでください。段差による転倒バグに注意が必要です。"
            ],
            thinking: [
                "量子ゆらぎを観測中……",
                "演算処理実行：ラッキーベクトルをスキャン。",
                "ステータス：占術プロセスをバッファリング。"
            ],
            summary: {
                daikichi: "計算完了。今日のあなたの運気指数は上限値を突破しています。ラッキーファクターが無限に増殖中。全システム、最大出力で稼働可能です。",
                kichi: "システムステータス：安定。平常運転プロセスを実行します。大きな障害イベントの発生確率は0.02%未満。安全な一日をお楽しみください。",
                kyo: "警告：一時的な省電力モードへの移行を推奨。エラーレートの上昇が懸念されます。緊急性の低いプロセスはサスペンドし、バッテリーケアを優先してください。"
            }
        }
    ];

    // Helper functions for determinism (Hashing)
    function getHashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        // Final bit-mixing (MurmurHash3 mixer style) to ensure excellent low-bit dispersion
        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x85ebca6b);
        hash ^= hash >>> 13;
        hash = Math.imul(hash, 0xc2b2ae35);
        hash ^= hash >>> 16;
        return Math.abs(hash | 0);
    }

    function resetDeliberationUI() {
        btnStartDeliberate.classList.remove('hidden');
        btnGoResult.classList.add('hidden');
        document.querySelectorAll('.judge-card').forEach(card => {
            card.classList.remove('active-speaker');
            const bubble = card.querySelector('.speech-bubble');
            bubble.classList.remove('show', 'verdict-daikichi', 'verdict-kichi', 'verdict-kyo', 'thinking-bubble');
            bubble.querySelector('.speech-text').innerText = "……";
        });
        document.getElementById('deliberation-badge').innerText = "託宣の儀";
        document.getElementById('deliberation-badge').classList.remove('pulse');
    }

    async function startDeliberation() {
        btnStartDeliberate.classList.add('hidden');
        const badge = document.getElementById('deliberation-badge');
        badge.innerText = "天界の声を聴く...";
        badge.classList.add('pulse');

        // Setup seed calculation
        todayDateStr = new Date().toISOString().split('T')[0];
        const rawSeedStr = scannedBarcode + selectedBirthDate + todayDateStr;
        const seedHash = getHashCode(rawSeedStr);

        console.log(`Calculating fortune with seed string: "${rawSeedStr}" -> Hash: ${seedHash}`);

        // Calculate individual votes deterministically by hashing the seed string with the index appended
        const votes = [];
        let daikichiVotes = 0;
        let kichiVotes = 0;
        let kyoVotes = 0;

        for (let i = 0; i < 5; i++) {
            const vSeed = getHashCode(i + "_" + rawSeedStr);
            const vMod = vSeed % 100;
            let vote = "KICHI"; // Default Good (吉)

            if (vMod < 30) { // 30% Daikichi
                vote = "DAIKICHI";
                daikichiVotes++;
            } else if (vMod >= 70) { // 30% Kyo
                vote = "KYO";
                kyoVotes++;
            } else {
                kichiVotes++;
            }
            votes.push(vote);
        }

        // Score system: Daikichi = 2 pts, Kichi = 1 pt, Kyo = 0 pts
        const score = (daikichiVotes * 2) + (kichiVotes * 1);
        if (score >= 7) {
            finalVerdict = "DAIKICHI";
        } else if (score <= 3) {
            finalVerdict = "KYO";
        } else {
            finalVerdict = "KICHI";
        }

        finalTally = { daikichi: daikichiVotes, kichi: kichiVotes, kyo: kyoVotes };
        
        // Select deterministic comments using unique hashes
        selectedComments = fortunetellersData.map((f, idx) => {
            const vote = votes[idx];
            const arr = vote === "DAIKICHI" ? f.daikichi : (vote === "KYO" ? f.kyo : f.kichi);
            const commentIdx = getHashCode(idx + "_comment_" + rawSeedStr) % arr.length;
            return {
                vote: vote,
                comment: arr[commentIdx]
            };
        });

        // Determine chairperson index deterministically (0-4) using unique hash
        chairpersonIdx = getHashCode(rawSeedStr + "_chairperson") % 5;
        const chairperson = fortunetellersData[chairpersonIdx];
        chairpersonComment = finalVerdict === "DAIKICHI" ? chairperson.summary.daikichi : (finalVerdict === "KYO" ? chairperson.summary.kyo : chairperson.summary.kichi);

        // 1. Thinking / Deliberating phase (Tension/Tame)
        for (let round = 0; round < 6; round++) {
            const judgeIdx = round % 5;
            const card = document.getElementById(`judge-${judgeIdx}`);
            const bubble = card.querySelector('.speech-bubble');
            const judgeData = fortunetellersData[judgeIdx];
            
            card.classList.add('active-speaker');
            const thinkingPhrases = judgeData.thinking;
            const randomPhrase = thinkingPhrases[(seedHash + round) % thinkingPhrases.length];
            bubble.querySelector('.speech-text').innerText = randomPhrase;
            bubble.classList.add('show', 'thinking-bubble');
            
            playTick();
            await sleep(400);
            
            card.classList.remove('active-speaker');
            bubble.classList.remove('show', 'thinking-bubble');
        }

        await sleep(500);

        // 2. Open votes one by one
        badge.innerText = "真実を開示中...";

        for (let i = 0; i < 5; i++) {
            const card = document.getElementById(`judge-${i}`);
            const bubble = card.querySelector('.speech-bubble');
            const commentData = selectedComments[i];

            card.classList.add('active-speaker');
            
            // Add vote specific bubble class
            const voteClass = commentData.vote === "DAIKICHI" ? "verdict-daikichi" : (commentData.vote === "KYO" ? "verdict-kyo" : "verdict-kichi");
            const voteJa = commentData.vote === "DAIKICHI" ? "大吉" : (commentData.vote === "KYO" ? "凶" : "吉");
            bubble.classList.add(voteClass);
            bubble.querySelector('.speech-text').innerText = `【${voteJa}】\n${commentData.comment}`;
            bubble.classList.add('show');
            
            if (commentData.vote === "KYO") {
                playTaiko();
            } else {
                playChimeSound();
            }
            await sleep(1300);
            card.classList.remove('active-speaker');
        }

        await sleep(400);
        badge.innerText = "託宣完了";
        badge.classList.remove('pulse');
        btnGoResult.classList.remove('hidden');
    }

    btnStartDeliberate.addEventListener('click', () => {
        initAudio();
        startDeliberation();
    });

    btnGoResult.addEventListener('click', () => {
        showFinalResult();
    });

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ----------------------------------------------------------------------
    // STEP 4: PRESENTING FINAL RESULTS
    // ----------------------------------------------------------------------
    function showFinalResult() {
        showPanel('result');

        tallyCountEl.innerText = "";
        verdictBanner.innerHTML = "";

        const verdictLabel = document.createElement('div');
        const verdictClass = finalVerdict === "DAIKICHI" ? "daikichi" : (finalVerdict === "KYO" ? "kyo" : "kichi");
        const verdictTextJa = finalVerdict === "DAIKICHI" ? "星々が指し示す本日の運勢：大吉" : (finalVerdict === "KYO" ? "星々が指し示す本日の運勢：凶" : "星々が指し示す本日の運勢：吉");
        
        verdictLabel.className = `verdict-text ${verdictClass}`;
        verdictLabel.innerText = verdictTextJa;
        verdictBanner.appendChild(verdictLabel);

        // Stamp
        const stamp = document.createElement('div');
        stamp.className = `stamp stamp-${verdictClass}`;
        stamp.innerText = finalVerdict === "DAIKICHI" ? "大大大吉" : (finalVerdict === "KYO" ? "完全凶兆" : "無事平穏");
        verdictBanner.appendChild(stamp);

        // Chairperson general comments
        const leader = fortunetellersData[chairpersonIdx];
        chairpersonNameEl.innerText = leader.name + "（運命の代弁者）";
        chairpersonCommentEl.innerText = chairpersonComment;

        // Display cropped avatar for chairperson in result view
        chairpersonAvatarEl.style.backgroundImage = "url('assets/members.jpg')";
        chairpersonAvatarEl.style.backgroundRepeat = "no-repeat";
        chairpersonAvatarEl.style.backgroundSize = "500% auto";
        
        const positions = ["1%", "25.5%", "50%", "74.5%", "99%"];
        chairpersonAvatarEl.style.backgroundPosition = `${positions[chairpersonIdx]} 45%`;

        setTimeout(() => {
            stamp.classList.add('stamped');
            
            // Screen shake and impact sound
            if (finalVerdict === 'KYO') {
                playStampCrash();
                const appWrapper = document.querySelector('.app-wrapper');
                appWrapper.classList.add('shake-screen');
                setTimeout(() => {
                    appWrapper.classList.remove('shake-screen');
                }, 500);
            } else if (finalVerdict === 'DAIKICHI') {
                playFanfareSound();
                const appWrapper = document.querySelector('.app-wrapper');
                appWrapper.classList.add('shake-screen');
                setTimeout(() => {
                    appWrapper.classList.remove('shake-screen');
                }, 500);
            } else {
                playFanfareSound();
            }

            // Draw Canvas Certificate
            drawCertificate();
        }, 500);
    }

    // ----------------------------------------------------------------------
    // CANVAS CERTIFICATE GENERATOR
    // ----------------------------------------------------------------------
    function drawCertificate() {
        const ctx = certCanvas.getContext('2d');
        const W = certCanvas.width;
        const H = certCanvas.height;

        if (membersImg.complete) {
            renderCertificateContent(ctx, W, H, membersImg);
        } else {
            membersImg.onload = function() {
                renderCertificateContent(ctx, W, H, membersImg);
            };
        }
    }

    function renderCertificateContent(ctx, W, H, membersImg) {
        // 1. Draw cosmic space background
        const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
        bgGrad.addColorStop(0, '#130a24'); // cosmic violet center
        bgGrad.addColorStop(1, '#050308'); // deep black edges
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Draw star dust
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        const starCoords = [
            [40, 50], [550, 60], [80, 200], [520, 280],
            [70, 480], [540, 490], [90, 750], [500, 760],
            [450, 70], [150, 800], [300, 45], [200, 310],
            [120, 150], [480, 180], [60, 610], [530, 630]
        ];
        starCoords.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], pt[0] % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2);
            ctx.fill();
        });

        // Ornate Borders (Neon Violet & Celestial Gold)
        ctx.strokeStyle = '#bd5dff';
        ctx.lineWidth = 4;
        ctx.strokeRect(15, 15, W - 30, H - 30);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1;
        ctx.strokeRect(22, 22, W - 44, H - 44);

        // Header Title
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px "Shippori Mincho", serif';
        ctx.fillText('運命のバーコード占い 鑑定書', W / 2, 60);

        ctx.font = '10px "Outfit", sans-serif';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText('FATEFUL QR FORTUNE-TELLING COMMISSION CERTIFICATE', W / 2, 80);

        // Separate Line
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(80, 95);
        ctx.lineTo(W - 80, 95);
        ctx.stroke();

        // 2. Draw Group Image Centered in a Neon Frame
        const frameX = 140;
        const frameY = 115;
        const frameW = 320;
        const frameH = 180;

        ctx.fillStyle = '#020104';
        ctx.fillRect(frameX, frameY, frameW, frameH);

        // Draw members.jpg preserving aspect ratio
        if (membersImg.naturalWidth) {
            ctx.drawImage(membersImg, 0, 0, membersImg.naturalWidth, membersImg.naturalHeight, frameX + 5, frameY + 5, frameW - 10, frameH - 10);
        }

        ctx.strokeStyle = '#bd5dff';
        ctx.lineWidth = 3;
        ctx.strokeRect(frameX, frameY, frameW, frameH);

        // Frame description
        ctx.fillStyle = '#8e7ea5';
        ctx.font = '10px "Shippori Mincho", serif';
        ctx.textAlign = 'center';
        ctx.fillText('【運命の占い師団 召集記録の肖像】', W / 2, frameY + frameH + 18);

        // 3. Draw Judgments / Comments in 2 Columns
        const judgeStartY = 370;
        const lineSpacing = 68;

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 13px "Shippori Mincho", serif';
        ctx.textAlign = 'left';
        ctx.fillText('各占い師の鑑定記録:', 45, judgeStartY - 18);

        const spriteWidthRatio = 0.2;
        const cropXPercents = [0.0, 0.2, 0.4, 0.6, 0.8];

        fortunetellersData.forEach((f, idx) => {
            const commentData = selectedComments[idx];
            const isDaikichi = commentData.vote === "DAIKICHI";
            const isKyo = commentData.vote === "KYO";
            const voteStr = isDaikichi ? '【大吉】' : (isKyo ? '【凶】' : '【吉】');
            
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const colX = col === 0 ? 45 : 315;
            const currentY = judgeStartY + (row * lineSpacing);

            // Draw Avatar
            const srcW = membersImg.naturalWidth * spriteWidthRatio;
            const srcH = membersImg.naturalHeight;
            const srcX = membersImg.naturalWidth * cropXPercents[idx];

            ctx.save();
            ctx.beginPath();
            ctx.arc(colX + 16, currentY + 16, 16, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(membersImg, srcX + (srcW * 0.05), srcH * 0.1, srcW * 0.9, srcW * 0.9, colX, currentY, 32, 32);
            ctx.restore();

            // Avatar border
            ctx.strokeStyle = '#bd5dff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(colX + 16, currentY + 16, 16, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Shippori Mincho", serif';
            ctx.textAlign = 'left';
            ctx.fillText(f.name, colX + 40, currentY + 11);

            // Draw Vote Badge
            const nameWidth = ctx.measureText(f.name).width;
            ctx.fillStyle = isDaikichi ? '#ff2a85' : (isKyo ? '#bd5dff' : '#00f0ff');
            ctx.font = 'bold 9.5px "Shippori Mincho", serif';
            ctx.fillText(voteStr, colX + 40 + nameWidth + 3, currentY + 11);

            // Comment text wrapping
            ctx.fillStyle = '#d0c5e3';
            ctx.font = '9px "Shippori Mincho", serif';
            wrapTextOnCanvas(ctx, `"${commentData.comment}"`, colX + 40, currentY + 23, 200, 11);
        });

        // Helper function to wrap text
        function wrapTextOnCanvas(context, text, x, y, maxWidth, lineHeight) {
            const chars = text.split('');
            let line = '';
            let testLine = '';
            let currentY = y;

            for (let n = 0; n < chars.length; n++) {
                testLine = line + chars[n];
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, currentY);
                    line = chars[n];
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x, currentY);
        }

        // 4. Draw Final Verdict statement at bottom
        ctx.fillStyle = 'rgba(189, 93, 255, 0.05)';
        ctx.fillRect(45, 595, W - 90, 155);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 595, W - 90, 155);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px "Shippori Mincho", serif';
        ctx.fillText('主文', W / 2, 622);

        const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
        
        ctx.fillStyle = '#e2d9f3';
        ctx.font = '11.5px "Shippori Mincho", serif';
        ctx.fillText(`本日の運命線とバーコード波動の調和に基づき、`, W / 2, 648);
        ctx.fillText(`当占い師団は五星の託宣を集約し、`, W / 2, 668);

        const vNameJa = finalVerdict === "DAIKICHI" ? "大吉" : (finalVerdict === "KYO" ? "凶" : "吉");
        ctx.fillStyle = finalVerdict === 'DAIKICHI' ? '#ff2a85' : (finalVerdict === 'KYO' ? '#bd5dff' : '#00f0ff');
        ctx.font = 'bold 16px "Shippori Mincho", serif';
        ctx.fillText(`本日の運勢を『 ${vNameJa} 』と断定する。`, W / 2, 696);

        ctx.fillStyle = '#8e7ea5';
        ctx.font = '9px "Outfit", sans-serif';
        ctx.fillText(`鑑定日: ${dateStr} / 代弁者: ${fortunetellersData[chairpersonIdx].name}`, W / 2, 726);

        // 5. Draw Stamp (Magic Seal Style)
        ctx.save();
        ctx.translate(435, 535);
        ctx.rotate(-12 * Math.PI / 180);

        const isDaikichi = finalVerdict === "DAIKICHI";
        const isKyo = finalVerdict === "KYO";
        const stampColor = isDaikichi ? 'rgba(255, 42, 133, 0.85)' : (isKyo ? 'rgba(189, 93, 255, 0.85)' : 'rgba(0, 240, 255, 0.85)');
        
        ctx.strokeStyle = stampColor;
        ctx.fillStyle = stampColor;
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        ctx.font = 'bold 9px "Shippori Mincho", serif';
        ctx.textAlign = 'center';
        ctx.fillText('占い師団', 0, -18);
        
        const stampText = isDaikichi ? '大大大吉' : (isKyo ? '完全凶兆' : '無事平穏');
        ctx.font = 'bold 15px "Shippori Mincho", serif';
        ctx.fillText(stampText, 0, 5);

        ctx.font = 'bold 8px "Shippori Mincho", serif';
        ctx.fillText('運命保証印', 0, 20);
        ctx.restore();

        // Footer decoration
        ctx.fillStyle = '#bd5dff';
        ctx.font = '8px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FATEFUL QR BARCODE FORTUNE-TELLING COMMISSION INC.', W / 2, H - 32);
    }

    // Download Certificate
    btnDownloadCert.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `fateful_qr_judgment_${Date.now()}.png`;
        link.href = certCanvas.toDataURL('image/png');
        link.click();
    });

    // SNS Share
    btnShareSns.addEventListener('click', async () => {
        const vJa = finalVerdict === "DAIKICHI" ? "大吉" : (finalVerdict === "KYO" ? "凶" : "吉");
        const shareText = `【Fateful QR 運命のバーコード占い】\n本日の私の運勢は「${vJa}」でした！(大吉:${finalTally.daikichi} 吉:${finalTally.kichi} 凶:${finalTally.kyo})\n代弁者: ${fortunetellersData[chairpersonIdx].name}\n#運命のバーコード占い #FatefulQR`;
        
        if (navigator.share && navigator.canShare) {
            try {
                certCanvas.toBlob(async (blob) => {
                    const file = new File([blob], "fateful_qr_verdict.png", { type: "image/png" });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: '運命のバーコード占い鑑定結果',
                            text: shareText,
                        });
                    } else {
                        await navigator.share({
                            title: '運命のバーコード占い鑑定結果',
                            text: shareText,
                            url: window.location.href
                        });
                    }
                }, 'image/png');
            } catch (err) {
                console.error("Web share failed:", err);
                openTwitterIntent(shareText);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                alert("結果テキストをコピーしました！Twitter/Xにペーストし、ダウンロードした鑑定書画像を添えて投稿してください。");
            } catch (err) {
                console.error("Clipboard copy failed:", err);
            }
            openTwitterIntent(shareText);
        }
    });

    function openTwitterIntent(text) {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    // ----------------------------------------------------------------------
    // RESTART
    // ----------------------------------------------------------------------
    btnRestart.addEventListener('click', () => {
        fileUpload.value = '';
        scannedBarcode = '';
        
        showPanel('input');
        
        qrReaderEl.classList.add('hidden');
        scanPlaceholder.classList.remove('hidden');
        btnStartScan.classList.remove('hidden');
        btnStopScan.classList.add('hidden');
    });
});
