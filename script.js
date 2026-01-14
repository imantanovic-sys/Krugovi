 // glavni canvas
	const canvas = document.querySelector("#mycanvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	const c = canvas.getContext("2d");
	//canvas za pozadinu
	const gridCanvas = document.createElement("canvas");
	const gridCtx = gridCanvas.getContext("2d");



	let tema = "dark";
	
    //mreza u pozadini
	function napraviGrid() {
		gridCanvas.width = canvas.width;
		gridCanvas.height = canvas.height;

		gridCtx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
		const cell = 40;
		gridCtx.strokeStyle = (tema === "dark") ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";
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

		
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		napraviGrid();
	}

	window.addEventListener("resize", resizeCanvas);
	resizeCanvas();


	const igraStart = document.getElementById("igraStart");
	const finalScore = document.getElementById("finalScore");
	const startBtn = document.getElementById("startBtn");
	const temaBtn = document.getElementById("temaBtn");
	const temaBtn2 = document.getElementById("temaBtn2");
	const resetHighScore = document.getElementById("reset_hs");
	const resetHighScore2 = document.getElementById("reset_hs2");
	const pauzaBtn = document.getElementById("pauzaBtn");
	const pauzaBtnSpan = document.getElementById("pauzaBtnSpan");
	const naslov = document.getElementById("naslov");
	const helpBtn = document.getElementById("helpBtn");
	const helpProzor = document.getElementById("help");
	const zatvoriHelpBtn = document.getElementById("zatvoriHelpBtn");

	helpBtn.addEventListener("click", () => helpProzor.showModal()); 
	zatvoriHelpBtn.addEventListener("click", () => helpProzor.close()); 


	let rafId = null;
	let running = false;
	let gameOver = false;
	let highScore = document.getElementById("highScore");
	let highScore2 = document.getElementById("highScore2");

	const HS_KEY = "krugovi_highscore";
	let hs = Number(localStorage.getItem(HS_KEY)) || 0;
	highScore.textContent = "Lični rekord: " + Math.round(hs);

	const igracBoje = {crvena :7, plava : 196, zelena : 141}; //biljezi hue da mozemo ostale krugove obojit komplementarno
	let mojaBoja = '#EE6352';

	


	function igracBojaHue() {
		const el = document.querySelector('input[name="igracBoja"]:checked');

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


	let pauza = false;
	const pauziraj = document.getElementById("pauziraj");
	let cekajKursor = false;

	let Krugovi = [];
	let bonusi = [];

	let startTime = null;
	let lastTick = 0;
	let interval = 7000;   

	let mojRadius = 20;

	let flashDo = 0;          // timestamp u ms do kada traje flash
	const FLASH_MS = 200;       

	const M = { x: canvas.width / 2, y: canvas.height / 2 };

	const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
	if (isTouch) {
	  canvas.style.touchAction = "auto";
	
	  canvas.addEventListener("pointerdown", (e) => {
	    if (!running || pauza || gameOver) return; 
	    M.x = e.clientX;
	    M.y = e.clientY;
	    canvas.setPointerCapture(e.pointerId);
	  });
	
	  canvas.addEventListener("pointermove", (e) => {
	    if (!running || pauza || gameOver) return;
	    M.x = e.clientX;
	    M.y = e.clientY;
	  });
	} else {
	  window.addEventListener("mousemove", (e) => {
	    M.x = e.clientX;
	    M.y = e.clientY;
	  });
	}
	function togglePauza(){
		pauza = !pauza;
		pauziraj.style.display = (pauza && !isTouch) ? "flex" : "none";

		if (!pauza) {
			// nastavi loop
			startTime = null;    //resetuje timer da bonusi ne preskoce
			lastTick = 0;
			rafId = requestAnimationFrame(animiraj);
		} else {
			// zaustavi trenutni zakazani frame
			
			if (!isTouch && Krugovi[0]) {
			M.x = Krugovi[0].x;
			M.y = Krugovi[0].y;
			}
			cekajKursor = true;
			if (rafId) cancelAnimationFrame(rafId);  
		}

	}

	window.addEventListener("keydown", (e) => {
		if (e.key.toLowerCase() !== "p") return;
		if (!running) return;          // ne pauziraj ako nije u igri
		if (gameOver) return;
		togglePauza();
		
	});


	function postaviTemu() {
		canvas.style.background = (tema === "dark") ? "#000" : "#E5E4E2";
		igraStart.style.background =(tema == "dark") ? "rgba(18, 20, 24, 0.6)" : "rgba(18, 20, 24, 0.3)"; 
	}

	function updateTemaBtn() {
		const label = "tema: " + (tema === "dark" ? "Dark" : "Light");
		if (temaBtn) temaBtn.textContent = label;
		if (temaBtn2) temaBtn2.textContent = label;
	}

	postaviTemu();
	updateTemaBtn();

	function generisiRndBoju() {//generise boje koje kontrastuju glavnog igraca na osnovu njegovog hue
		const base = igracBojaHue();
		const compHue = (base + 180) % 360; // komplement

		// random varijacija oko komplementa (da ne bude uvijek ista boja)
		const spread = 60; // stepen koliko smije odstupat od pravog komplementa
		const h = (compHue + (Math.random() * 2 - 1) * spread + 360) % 360;

		// pravi ciste boje (da nisu sive)
		const s = 80 + Math.random() * 20;

		// tema podesava lightness
		const l = (tema === "dark")
				? (60 + Math.random() * 20)
				: (30 + Math.random() * 20);

		return `hsl(${h}, ${s}%, ${l}%)`;
	}

	function promijeniTemu() {
		tema = (tema === "dark") ? "light" : "dark";
		postaviTemu();
		updateTemaBtn();
		napraviGrid();
	}

	function resetujHS() {
		hs = 0;
		localStorage.setItem(HS_KEY, "0");
		highScore.textContent = "Lični rekord: 0";
		highScore2.textContent = "Lični rekord: 0";
	}

	// event handleri
	temaBtn.addEventListener("click", promijeniTemu);
	
	resetHighScore.addEventListener("click", resetujHS);
	

	// Helperi
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
	function pojedenBonus(krug, bonus) {
    return udaljenost(krug.x, krug.y, bonus.x, bonus.y) < krug.r + 20;
}

	function rndBonusBr() {
		let a = Math.floor(Math.random() * 6.99) - 3;
		if (a === 0) return -1;
		return a;
	}

	// klase
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
			(tema === 'dark') ? c.strokeStyle = "#F5F5F5" : c.strokeStyle = "#2A3439";
			c.lineWidth = 3;
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
			//da ne izadje iz ekrana nijednim dijelom
			if(x<this.r) x=this.r;
			if(x > canvas.width-this.r) x=canvas.width-this.r;
			if(y<this.r) y=this.r;
			if(y > canvas.height-this.r) y=canvas.height-this.r;
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

	//rnd obj
	function randomBonus() {
		return new Bonus(
				Math.random() * (canvas.width - 40) + 20,
				Math.random() * (canvas.height - 40) + 20,
				rndBonusBr()
		);
	}

	function randomKrug(a, b, c) {
		const r = Math.random() * (3 * c / 2) + c/2;
		let x, y;

		do {
			x = Math.random() * (canvas.width - 2 * r) + r;
			y = Math.random() * (canvas.height - 2 * r) + r;
		} while (udaljenost(x, y, a, b) < r + c + 200);

		const dx = Math.random() * 4 - 2;
		const dy = Math.random() * 4 - 2;
		return new Krug(x, y, r, dx, dy, generisiRndBoju());
	}

	// Heads-up display sa radiusom
	function nacrtajHUD() {
		c.font = "20px Arial";
		c.fillStyle = (tema === "dark") ? "white" : "black";
		c.textAlign = "left";
		c.textBaseline = "top";
		c.fillText("R: " + Math.round(Krugovi[0].r), 10, 10);
	}

	//glavni loop
	function animiraj(t) {
		if (!running || pauza) return;

		rafId = requestAnimationFrame(animiraj); // cuva ID da moze kasnije zaustavit

		if (startTime === null) { startTime = t; lastTick = 0; }
		const elapsed = t - startTime;

		if (elapsed - lastTick >= interval) {
			lastTick += interval;
			for (let i = 0; i < 3; i++) {
				if(i==1) {
					do{
						bonusi[i]=randomBonus();
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
				if (performance.now() < flashDo) {
					c.save();
					c.fillStyle ="rgba(255,255,255,0.65)";
					c.beginPath();
					c.arc(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r, 0, Math.PI * 2);
					c.fill();
					} 
				if (cekajKursor) {
					// ceka da se kursor vrati na krug
					const d = udaljenost(M.x, M.y, Krugovi[0].x, Krugovi[0].y);
					if (d <= Krugovi[0].r) {              
						cekajKursor = false;  
					} else {
						
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
				flashDo = performance.now() + FLASH_MS;
				Krugovi[0].povecajZa(1);
				Krugovi[i] = randomKrug(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r);

				for (let j = 1; j < Krugovi.length; j++) Krugovi[j].povecajBrzinu(0.02);
			} else {
				gameOver = true;
			}
		}

		// dodatni krug svako +10 radius
		if (Krugovi[0].r - 10 >= mojRadius && !isTouch) {//na touch uredjajima je premal prostor da se ovako brzo dodaju, igrica crasha
			Krugovi.push(randomKrug(Krugovi[0].x, Krugovi[0].y, Krugovi[0].r));
			mojRadius += 10;
		}

		// pojedi bonus
		for (let i = 0; i < bonusi.length; i++) {
			const b = bonusi[i];
			if (!b) continue;

			if (pojedenBonus(Krugovi[0], b)) {
				Krugovi[0].povecajZa(b.br);
				flashDo = performance.now() + FLASH_MS;
				bonusi[i] = null;
				if (Krugovi[0].r < 1) Krugovi[0].r = 1;
			}
		}

		nacrtajHUD();

		if (gameOver) {
			endGame();
		}
	}

	// Start/Restart
	function resetGame() {
		
		// reset tajmera i state-a
		igracBojaHue();
		startTime = null;
		lastTick = 0;
		gameOver = false;

		mojRadius = 10;

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
		if (isTouch) canvas.style.touchAction = "none";
		if (rafId) cancelAnimationFrame(rafId); // da ne bi sluc bila 2 loop-a
		resetGame();
		napraviGrid();

		running = true;
		igraStart.style.display = "none";
		if(isTouch) pauzaBtnSpan.style.display = "flex";
		rafId = requestAnimationFrame(animiraj);
	}

	function endGame() {
		if (isTouch) canvas.style.touchAction = "auto";
		running = false;
		gameOver = true;

		if (rafId) cancelAnimationFrame(rafId); // stop
		if (Krugovi[0].r > hs){
			hs = Krugovi[0].r;
			localStorage.setItem(HS_KEY, String(Math.round(hs)));
		}
		highScore.textContent = "Lični rekord: " + Math.round(hs);
		finalScore.textContent = "Radius: " + Math.round(Krugovi[0].r);
		pauzaBtnSpan.style.display = "none";
		naslov.textContent = "Game Over";
		startBtn.textContent = "Restart";
		igraStart.style.display = "flex";
	}

	// Dugmici za start
	startBtn.addEventListener("click", startGame);
	pauzaBtn.addEventListener("click", togglePauza);