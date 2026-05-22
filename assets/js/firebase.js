import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
  import { getAuth, createUserWithEmailAndPassword,
           signInWithEmailAndPassword, signOut,
           onAuthStateChanged }                     from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
  import { getFirestore, doc, getDoc, setDoc }      from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

  // ── Config do seu projeto ──
  const firebaseConfig = {
    apiKey:            "AIzaSyCez1IuaeyrfcaUxRJ0CPfrzHYC2jmCNMA",
    authDomain:        "ecopatinhas.firebaseapp.com",
    projectId:         "ecopatinhas",
    storageBucket:     "ecopatinhas.firebasestorage.app",
    messagingSenderId: "709334785612",
    appId:             "1:709334785612:web:6b2cf82bc858dedef55ee9"
  };

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // ── Elementos da tela de login ──
  const loginScreen = document.getElementById('loginScreen');
  const tabLogin    = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const emailInput  = document.getElementById('authEmail');
  const passInput   = document.getElementById('authPassword');
  const submitBtn   = document.getElementById('authSubmit');
  const errorMsg    = document.getElementById('authError');
  const loadingMsg  = document.getElementById('authLoading');
  const nickInput  = document.getElementById('authNickname');
  const nickField  = document.getElementById('nicknameField');

  let isRegisterMode = false;

  // ── Alterna entre Entrar / Criar conta ──
  tabLogin.addEventListener('click', () => {
    isRegisterMode = false;
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    submitBtn.textContent = 'Entrar';
    errorMsg.textContent = '';
    nickField.style.display = 'none';
  });
  tabRegister.addEventListener('click', () => {
    isRegisterMode = true;
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    submitBtn.textContent = 'Criar conta';
    errorMsg.textContent = '';
    nickField.style.display = 'block';
  });

  // ── Traduz erros do Firebase pro português ──
  function traduzErro(code) {
    const erros = {
      'auth/invalid-email':          'E-mail inválido.',
      'auth/user-not-found':         'Conta não encontrada.',
      'auth/wrong-password':         'Senha incorreta.',
      'auth/email-already-in-use':   'E-mail já cadastrado.',
      'auth/weak-password':          'Senha muito fraca. Use no mínimo 6 caracteres.',
      'auth/too-many-requests':      'Muitas tentativas. Aguarde um momento.',
      'auth/invalid-credential':     'E-mail ou senha incorretos.',
    };
    return erros[code] || 'Algo deu errado. Tente novamente.';
  }

  // ── Envia o formulário ──
  submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    errorMsg.textContent = '';

    if (!email || !pass) { errorMsg.textContent = 'Preencha e-mail e senha.'; return; }

    submitBtn.disabled = true;
    loadingMsg.classList.remove('hidden');

    try {
      if (isRegisterMode) {
        const nick = nickInput.value.trim();
        if (nick.length < 2) { errorMsg.textContent = 'Apelido muito curto (mín. 2 caracteres).'; submitBtn.disabled = false; loadingMsg.classList.add('hidden'); return; }
        if (!/^[a-zA-ZÀ-ÿ0-9 _-]+$/.test(nick)) { errorMsg.textContent = 'Use apenas letras, números, espaço, _ ou -.'; submitBtn.disabled = false; loadingMsg.classList.add('hidden'); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        // salva nickname imediatamente após criar conta
        await setDoc(doc(db, 'usuarios', cred.user.uid), { nickname: nick });
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
      // onAuthStateChanged cuida do resto
    } catch (e) {
      errorMsg.textContent = traduzErro(e.code);
      submitBtn.disabled = false;
      loadingMsg.classList.add('hidden');
    }
  });

  // Enter no campo de senha envia
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  // ── Salvar progresso no Firestore ──
  async function fbSaveProgress(uid) {
    const dados = {
      nickname: state.nickname || '',
      theme:        state.theme,
      levelIndex:   Math.min(state.levelIndex, levels.length - 1),
      bankCoins:    state.bankCoins,
      bagUpgrade:   state.bagUpgrade,
      speedUpgrade: state.speedUpgrade,
      specialSkin:  state.specialSkin,
      communityTotal: state.communityTotal,
      updatedAt:    Date.now()
    };
    try {
      await setDoc(doc(db, 'usuarios', uid), dados);
    } catch (e) {
      console.warn('Erro ao salvar no Firestore:', e);
    }
  }

  // ── Carregar progresso do Firestore ──
  async function fbLoadProgress(uid) {
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (!snap.exists()) return; // primeira vez — usa defaults
      const d = snap.data();
      state.nickname = d.nickname ?? '';
      state.theme        = d.theme        ?? 'green';
      state.levelIndex   = d.levelIndex   ?? 0;
      state.bankCoins    = d.bankCoins    ?? 0;
      state.bagUpgrade   = d.bagUpgrade   ?? 0;
      state.speedUpgrade = d.speedUpgrade ?? 0;
      state.specialSkin  = d.specialSkin  ?? false;
      state.communityTotal = d.communityTotal ?? 0;
      // Sincroniza localStorage também (saveProgress do jogo usa ele)
      localStorage.setItem('ecopatinhas_theme',  state.theme);
      localStorage.setItem('ecopatinhas_level',  String(state.levelIndex));
      localStorage.setItem('ecopatinhas_coins',  String(state.bankCoins));
      localStorage.setItem('ecopatinhas_bag',    String(state.bagUpgrade));
      localStorage.setItem('ecopatinhas_speed',  String(state.speedUpgrade));
      localStorage.setItem('ecopatinhas_skin',   String(state.specialSkin));
      localStorage.setItem('ecopatinhas_total',  String(state.communityTotal));
    } catch (e) {
      console.warn('Erro ao carregar do Firestore:', e);
    }
  }

  // ── Monitora estado de autenticação ──
  // É chamada automaticamente ao carregar a página e toda vez que o login muda
  let currentUid = null;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ✅ Usuário logado
      currentUid = user.uid;

      // Carrega dados do servidor
      await fbLoadProgress(user.uid);

      // Aplica tema e atualiza telas
      applyTheme(state.theme);
      updateHud();
      updateShop();
      buildLevel();

      // Esconde tela de login, mostra o jogo
      loginScreen.classList.add('hidden');

      // Sobreescreve saveProgress pra salvar no Firebase também
      window._fbSaveProgress = () => fbSaveProgress(user.uid);
      const _origSave = window.saveProgress || (() => {});
      // Patch: toda vez que o jogo salvar localmente, também salva no Firebase
      const originalSaveProgress = saveProgress;
      window.saveProgressOriginal = originalSaveProgress;

    } else {
      // ❌ Não logado — mostra tela de login
      currentUid = null;
      loginScreen.classList.remove('hidden');
      submitBtn.disabled = false;
      loadingMsg.classList.add('hidden');
    }
  });

  // Patch do saveProgress — injeta salvamento no Firebase em cima do original
  const _gameSaveProgress = saveProgress;
  window.saveProgress = function() {
    _gameSaveProgress();
    if (currentUid) fbSaveProgress(currentUid);
  };

  // ── Botão de logout ──
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Sair da conta?')) return;
    await signOut(auth);
    toast('Até logo! 👋');
  });