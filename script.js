// ===== Canvas setup =====
	const canvas = document.querySelector("canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	const c = canvas.getContext("2d");
	//canvas za pozadinu
	const gridCanvas = document.createElement("canvas");
	const gridCtx = gridCanvas.getContext("2d");

	let theme = "dark";
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// ako koristiš cache-ovani grid:
		rebuildGrid();

		// ako je igra u toku, dobro je i centrirati miš ili samo ostaviti
		// M.x = canvas.width / 2; M.y = canvas.height / 2;
	}

	window.addEventListener("resize", resizeCanvas);
	resizeCanvas(); // pozovi jednom na startu


	function rebuildGrid() {
		gridCanvas.width = canvas.width;
		gridCanvas.height = canvas.height;

		gridCtx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
		// iskoristi tvoju logiku, samo crtaj na gridCtx umjesto c
		const cell = 40;
		gridCtx.strokeStyle = (theme === "dark") ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";
		gridCtx.lineWidth = 1;

		for (let x = 0; x <= gridCanvas.width; x += cell) {
			gridCtx.beginPath();
			gridCtx.moveTo(x, 0);
			gridCtx.lineTo(x, gridCanvas.height);
			gridCtx.stroke();
		}
		for (let y = 0; y <= gridCanvas.height; y += cell) {
			gridCtx.beginPath();
			gridCtx.moveTo(0, y);
			gridCtx.lineTo(gridCanvas.width, y);
			gridCtx.stroke();
		}
	}

	// ===== UI elements =====
	const menu = document.getElementById("menu");
	const gameOverScreen = document.getElementById("gameOverScreen");
	const finalScore = document.getElementById("finalScore");
	const startBtn = document.getElementById("startBtn");
	const restartBtn = document.getElementById("restartBtn");
	const themeBtn = document.getElementById("themeBtn");
	const themeBtn2 = document.getElementById("themeBtn2");
	const resetHighScore = document.getElementById("reset_hs");
	const resetHighScore2 = document.getElementById("reset_hs2");

	// ===== Game state (GLOBAL, bez shadowing-a) =====
	let rafId = null;
	let running = false;
	let gameOver = false;
	let highScore = document.getElementById("highScore");
	let highScore2 = document.getElementById("highScore2");

	const HS_KEY = "krugovi_highscore";
	let hs = Number(localStorage.getItem(HS_KEY)) || 0;  // ako nema, 0
	highScore.textContent = "Lični rekord: " + Math.round(hs);

	const igracBoje = {crvena :7, plava : 196, zelena : 141};
	let mojaBoja = '#EE6352';


	function igracBojaHue() {
		const el = document.querySelector('input[name="playerColor"]:checked');

		if (!el) {
			mojaBoja = "#EE6352";
			return igracBoje.crvena;
		}

		if (el.value === "p") { mojaBoja = "#1C6E8C"; return igracBoje.plava; }
		if (el.value === "c") { mojaBoja = "#EE6352"; return igracBoje.crvena; }
		if (el.value === "z") { mojaBoja = "#57A773"; return igracBoje.zelena; }

		mojaBoja = "#EE6352";
		return igracBoje.crvena;
	}


	let paused = false;
	const pauseScreen = document.getElementById("pauseScreen");
	let cekajKursor = false;

	let Krugovi = [];
	let bonusi = [];

	let startTime = null;
	let lastTick = 0;
	let interval = 7000;   // ms

	let mojRadius = 20;

	let flashUntil = 0;          // timestamp u ms do kada traje flash
	const FLASH_MS = 200;        // npr. 250ms (probaj 150–300)

	// ===== Input (mouse) =====
	const M = { x: canvas.width / 2, y: canvas.height / 2 };

	window.addEventListener("keydown", (e) => {
		if (e.key.toLowerCase() !== "p") return;
		if (!running) return;          // ne pauziraj ako nije u igri
		if (gameOver) return;

		paused = !paused;
		pauseScreen.style.display = paused ? "flex" : "none";

		if (!paused) {
			// nastavi loop
			startTime = null;    // opcionalno: resetuj timer da ti bonusi ne “preskoče”
			lastTick = 0;
			rafId = requestAnimationFrame(animiraj);
		} else {
			// zaustavi trenutni zakazani frame
			M.x = Krugovi[0].x;
			M.y = Krugovi[0].y;
			cekajKursor = true;
			if (rafId) cancelAnimationFrame(rafId);  // [web:443]
		}
	});


	window.addEventListener("mousemove", (event) => {
		M.x = event.x;
		M.y = event.y;
	});

	// ===== Theme + colors =====


	function applyTheme() {
		canvas.style.background = (theme === "dark") ? "#000" : "#E5E4E2";
	}

	function updateThemeButtons() {
		const label = "Theme: " + (theme === "dark" ? "Dark" : "Light");
		if (themeBtn) themeBtn.textContent = label;
		if (themeBtn2) themeBtn2.textContent = label;
	}

	applyTheme();
	updateThemeButtons();

	function generisiRndBoju() {//generise boje koje kontrastuju glavnog igraca na osnovu njegovog hue
		const base = igracBojaHue();
		const compHue = (base + 180) % 360; // komplement [web:664]

		// random varijacija oko komplementa (da ne bude uvijek ista boja)
		const spread = 60; // stepeni, povećaj/smanji po ukusu
		const h = (compHue + (Math.random() * 2 - 1) * spread + 360) % 360;

		// drži boje “čiste” (dalje od sivih)
		const s = 80 + Math.random() * 20;

		// theme podešava lightness kao prije
		const l = (theme === "dark")
				? (60 + Math.random() * 20)
				: (30 + Math.random() * 20);

		return `hsl(${h}, ${s}%, ${l}%)`;
	}

	function toggleTheme() {
		theme = (theme === "dark") ? "light" : "dark";
		applyTheme();
		updateThemeButtons();
		rebuildGrid();
		// odmah promijeni boje postojećih krugova
		for (const k of Krugovi) {
			if (k) k.boja = generisiRndBoju();
		}
	}

	function resetujHS() {
		hs = 0;
		localStorage.setItem(HS_KEY, "0");
		highScore.textContent = "Lični rekord: 0";
		highScore2.textContent = "Lični rekord: 0";
	}

	// event handleri (bolje nego inline onclick) [web:422]
	themeBtn.addEventListener("click", toggleTheme);
	themeBtn2.addEventListener("click", toggleTheme);
	resetHighScore.addEventListener("click", resetujHS);
	resetHighScore2.addEventListener("click", resetujHS);

	// ===== Helpers =====
	function udaljenost(x1, y1, x2, y2) {
		return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
	}

	function pojeden(k1, k2) {
		const veci_radius = Math.max(k1.r, k2.r);
		if (udaljenost(k1.x, k1.y, k2.x, k2.y) < veci_radius) {
			return (k1.r === veci_radius) ? k2 : k1;
		}
		return null;
	}

	function rndBonusBr() {
		let a = Math.floor(Math.random() * 6.99) - 3;
		if (a === 0) return -1;
		return a;
	}

	// ===== Classes =====
	function Krug(x, y, r, dx, dy, boja) {
		this.x = x;
		this.y = y;
		this.dx = dx;
		this.dy = dy;
		this.r = r;
		this.boja = boja;

		this.nacrtaj = function () {
			c.beginPath();
			c.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
			(theme === 'dark') ? c.strokeStyle = "#F5F5F5" : c.strokeStyle = "#2A3439";
			c.lineWidth = 5;
			c.stroke();
			c.fillStyle = this.boja;
			c.fill();
		};

		this.pomjeri = function () {
			if (this.x + this.r > canvas.width || this.x - this.r < 0) this.dx = -this.dx;
			if (this.y + this.r > canvas.height || this.y - this.r < 0) this.dy = -this.dy;
			this.x += this.dx;
			this.y += this.dy;
		};

		this.pozicioniraj = function (x, y) {
			this.x = x;
			this.y = y;
		};

		this.povecajZa = function (dr) {
			this.r += dr;
		};

		this.povecajBrzinu = function (f) {
			this.dx = this.dx > 0 ? this.dx + f : this.dx - f;
			this.dy = this.dy > 0 ? this.dy + f : this.dy - f;
		};
	}

	function Bonus(x, y, br) {
		this.r = 0; // da "pojeden" radi s tvojom logikom
		this.x = x;
		this.y = y;
		this.br = br;
		this.boja = br < 0 ? "red" : "green";

		this.nacrtaj = function () {
			c.beginPath();
			c.moveTo(this.x, this.y+20);
			c.lineTo(this.x+20,this.y);
			c.lineTo(this.x,this.y-20);
			c.lineTo(this.x-20,this.y);
			c.lineTo(this.x, this.y+20);
			c.fillStyle = this.boja;
			c.fill();
			(br > 0) ? c.strokeStyle = "#004225" : c.strokeStyle = "#990000";
			c.lineWidth = 2;
			c.stroke();

			c.fillStyle = "white";
			c.font = "bold 15px Trebuchet MS";
			c.textAlign = "center";
			c.textBaseline = "middle";
			c.fillText(String(this.br), this.x, this.y);
		};
	}

	// ===== Spawners =====
	function randomBonus() {
		return new Bonus(
				Math.random() * (canvas.width - 40) + 20,
				Math.random() * (canvas.height - 40) + 20,
				rndBonusBr()
		);
	}

	function randomKrug(a, b, c) {
		const r = Math.random() * (3 * c / 2) + 5;
		let x, y;

		do {
			x = Math.random() * (canvas.width - 2 * r) + r;
			y = Math.random() * (canvas.height - 2 * r) + r;
		} while (udaljenost(x, y, a, b) < r + c + 200);

		const dx = Math.random() * 4 - 2;
		const dy = Math.random() * 4 - 2;
		return new Krug(x, y, r, dx, dy, generisiRndBoju());
	}

	// ===== HUD =====
	function nacrtajHUD() {
		c.font = "20px Arial";
		c.fillStyle = (theme === "dark") ? "white" : "black";
		c.textAlign = "left";
		c.textBaseline = "top";
		c.fillText("R: " + Math.round(Krugovi[0].r), 10, 10);
	}

	/*function nacrtajGrid(cell = 40, tema = 'light') {
		c.save();
		c.strokeStyle = (tema === "dark") ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
		c.lineWidth = 1;

		// vertikalne linije
		for (let x = 0; x <= canvas.width; x += cell) {
			c.beginPath();
			c.moveTo(x, 0);
			c.lineTo(x, canvas.height);
			c.stroke();
		}

		// horizontalne linije
		for (let y = 0; y <= canvas.height; y += cell) {
			c.beginPath();
			c.moveTo(0, y);
			c.lineTo(canvas.width, y);
			c.stroke();
		}

		c.restore();
	}*/


	// ===== Loop =====
	function animiraj(t) {
		if (!running || paused) return;

		rafId = requestAnimationFrame(animiraj); // čuvaj ID da možeš otkazati [web:443]

		if (startTime === null) { startTime = t; lastTick = 0; }
		const elapsed = t - startTime;

		if (elapsed - lastTick >= interval) {
			lastTick += interval;
			for (let i = 0; i < 3; i++) {
				if(i==1) {
					do{
						bonus[i]=randomBonus();
					} while (udaljenost(bonusi[i].x, bonusi[i].y, bonusi[0].x, bonusi[0].y) < window.innerWidth/4);
					continue;
				}
				if(i==2) {
					do{
						bonusi[i]=randomBonus();
					} while (udaljenost(bonusi[i].x, bonusi[i].y, bonusi[0].x, bonusi[0].y) < window.innerWidth/4 &&
							udaljenost(bonusi[i].x, bonusi[i].y, bonusi[1].x, bonusi[1].y) < window.innerWidth/4);
					continue;
				}
				bonusi[i]=randomBonus();

			}
		}

		c.clearRect(0, 0, canvas.width, canvas.height);
		c.drawImage(gridCanvas, 0, 0);

		// bonusi
		for (let i = 0; i < bonusi.length; i++) {
			const b = bonusi[i];
			if (b) b.nacrtaj();
		}

		// krugovi
		for (let i = 0; i < Krugovi.length; i++) {

			Krugovi[i].nacrtaj();


			if (i === 0) {
				if (performance.now() < flashUntil) {
					c.save();
					c.globalAlpha = 0.65;                 // jačina treptaja [web:550]
					c.fillStyle = "white";
					c.beginPath();
					c.arc(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r, 0, Math.PI * 2);
					c.fill();
					c.restore();} // vrati alpha da ne utiče na ostalo [web:554]
				if (cekajKursor) {
					// čekaj da se kursor vrati na krug
					const d = udaljenost(M.x, M.y, Krugovi[0].x, Krugovi[0].y);
					if (d <= Krugovi[0].r) {              // kursor je "na krugu" [web:636]
						cekajKursor = false;  // otključaj
					} else {
						// drži igrača gdje jeste, bez teleportovanja
						Krugovi[0].nacrtaj();
						continue;
					}
				}

				Krugovi[i].pozicioniraj(M.x, M.y);
				continue;
			}

			Krugovi[i].pomjeri();


			const p = pojeden(Krugovi[0], Krugovi[i]);
			if (!p) continue;

			if (p === Krugovi[i]) {
				flashUntil = performance.now() + FLASH_MS;
				Krugovi[0].povecajZa(1);
				Krugovi[i] = randomKrug(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r);

				for (let j = 1; j < Krugovi.length; j++) Krugovi[j].povecajBrzinu(0.05);
			} else {
				gameOver = true;
			}
		}

		// dodatni krug svako +10 radius
		if (Krugovi[0].r - 10 >= mojRadius) {
			Krugovi.push(randomKrug(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r));
			mojRadius += 10;
		}

		// pojedi bonus
		for (let i = 0; i < bonusi.length; i++) {
			const b = bonusi[i];
			if (!b) continue;

			if (pojeden(Krugovi[0], b)) {
				Krugovi[0].povecajZa(b.br);
				flashUntil = performance.now() + FLASH_MS;
				bonusi[i] = null;
				if (Krugovi[0].r < 1) Krugovi[0].r = 1;
			}
		}

		nacrtajHUD();

		if (gameOver) {
			endGame();
		}
	}

	// ===== Start/Restart =====
	function resetGame() {
		// reset tajmera i state-a
		igracBojaHue();
		startTime = null;
		lastTick = 0;
		gameOver = false;

		// reset praga za dodavanje novih krugova
		mojRadius = 20;

		// reset input na centar
		M.x = canvas.width / 2;
		M.y = canvas.height / 2;

		// napravi krugove
		Krugovi = [];
		Krugovi[0] = new Krug(M.x, M.y, mojRadius, 0, 0, mojaBoja);
		for (let i = 1; i < 10; i++) {
			Krugovi[i] = randomKrug(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r);
		}

		// napravi bonuse
		bonusi = [];
		for (let i = 0; i < 3; i++) bonusi[i] = randomBonus();
	}

	function startGame() {
		if (rafId) cancelAnimationFrame(rafId); // sigurnost da nema 2 loop-a [web:443]
		resetGame();
		rebuildGrid();

		running = true;
		menu.style.display = "none";
		gameOverScreen.style.display = "none";

		rafId = requestAnimationFrame(animiraj);
	}

	function endGame() {
		running = false;
		gameOver = true;

		if (rafId) cancelAnimationFrame(rafId); // stop [web:443]
		if (Krugovi[0].r > hs){
			hs = Krugovi[0].r;
			localStorage.setItem(HS_KEY, String(Math.round(hs)));
		}
		highScore2.textContent = "Lični rekord: " + Math.round(hs);
		finalScore.textContent = "Radius: " + Math.round(Krugovi[0].r);
		gameOverScreen.style.display = "flex";
	}

	// Button handlers
	startBtn.addEventListener("click", startGame);
	restartBtn.addEventListener("click", startGame);
