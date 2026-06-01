import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const EyeOpen = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const UserIcon = () => (
  <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const LockIcon = () => (
  <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const Sparkle = ({ cx, cy, r = 8, color }) => {
  const p = r * 0.38;
  return (
    <path
      d={`M${cx} ${cy - r} L${cx + p} ${cy - p} L${cx + r} ${cy} L${cx + p} ${cy + p} L${cx} ${cy + r} L${cx - p} ${cy + p} L${cx - r} ${cy} L${cx - p} ${cy - p} Z`}
      fill={color}
    />
  );
};

const Illustration = () => (
  <svg
    viewBox="0 0 460 400"
    style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "480px" }}
    aria-hidden="true"
  >
    {/* Orange tropical leaves - bottom left */}
    <path d="M30 400 C10 360 -10 310 35 270 C65 310 80 365 30 400Z" fill="#2ED05D" opacity="0.85"/>
    <path d="M10 400 C-20 355 -30 305 20 270 C55 310 65 370 10 400Z" fill="#0ea5e9" opacity="0.7"/>
    <path d="M65 390 C55 345 68 300 100 282 C105 320 95 368 65 390Z" fill="#2ED05D" opacity="0.6"/>

    {/* Orange/peach tropical plant - back right */}
    <path d="M400 400 C420 355 445 305 428 258 C402 292 382 355 400 400Z" fill="#25B04E"/>
    <path d="M425 400 C450 355 465 300 445 256 C415 295 398 360 425 400Z" fill="#FF9F4D" opacity="0.8"/>
    <path d="M380 400 C395 360 400 318 385 285 C365 318 362 375 380 400Z" fill="#25B04E" opacity="0.7"/>

    {/* Yellow/gold folder leaning center-left */}
    <g transform="rotate(-6,138,220)">
      <rect x="95" y="78" width="88" height="258" rx="7" fill="#0ea5e9"/>
      <rect x="95" y="78" width="88" height="18" rx="7" fill="#D4A800"/>
      <rect x="103" y="90" width="72" height="100" rx="3" fill="white" opacity="0.55"/>
      {[108,120,132,144,158].map((y,i) => (
        <line key={i} x1="110" y1={y} x2={i === 4 ? 160 : 167} y2={y} stroke="#D4A800" strokeWidth="1.5" opacity="0.5"/>
      ))}
    </g>

    {/* Bottom book - tangerine */}
    <rect x="128" y="336" width="244" height="48" rx="5" fill="#FFB38A"/>
    <rect x="128" y="336" width="22" height="48" rx="5" fill="#2ED05D"/>
    <rect x="358" y="340" width="14" height="40" rx="3" fill="#FFE4CC"/>

    {/* Middle book - yellow */}
    <rect x="138" y="294" width="226" height="45" rx="5" fill="#0ea5e9"/>
    <rect x="138" y="294" width="22" height="45" rx="5" fill="#E8B800"/>
    <rect x="352" y="298" width="12" height="37" rx="3" fill="#FFE999"/>

    {/* Top book - peach */}
    <rect x="148" y="258" width="208" height="39" rx="5" fill="#FFB38A"/>
    <rect x="148" y="258" width="20" height="39" rx="5" fill="#FF9955"/>
    <rect x="344" y="262" width="12" height="31" rx="3" fill="#FFD8B8"/>

    {/* Girl student */}
    <g transform="translate(310,178)">
      <path d="M-8 62 Q-24 82 -32 100" stroke="#F4A261" strokeWidth="10" strokeLinecap="round" fill="none"/>
      <path d="M8 62 Q18 80 22 100" stroke="#2ED05D" strokeWidth="10" strokeLinecap="round" fill="none"/>
      <ellipse cx="-32" cy="104" rx="9" ry="5" fill="#25B04E"/>
      <ellipse cx="22" cy="104" rx="9" ry="5" fill="#25B04E"/>
      <ellipse cx="0" cy="38" rx="23" ry="28" fill="#2ED05D"/>
      <rect x="-6" y="22" width="12" height="10" rx="3" fill="#F9DBBD"/>
      <circle cx="0" cy="8" r="21" fill="#F9DBBD"/>
      <path d="M-21 7 Q-20 -18 0 -21 Q20 -18 21 7 Q14 -6 0 -9 Q-14 -6 -21 7Z" fill="#1F1F1F"/>
      <path d="M-21 7 Q-26 20 -18 28" stroke="#1F1F1F" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M21 7 Q26 18 20 26" stroke="#1F1F1F" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <circle cx="-6" cy="8" r="2.8" fill="#3D2B1F"/>
      <circle cx="6" cy="8" r="2.8" fill="#3D2B1F"/>
      <circle cx="-5" cy="7" r="1" fill="white"/>
      <circle cx="7" cy="7" r="1" fill="white"/>
      <path d="M-5 15 Q0 20 5 15" stroke="#C47C5A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <rect x="-32" y="60" width="54" height="34" rx="4" fill="#2ED05D"/>
      <rect x="-30" y="62" width="50" height="28" rx="2" fill="#BBF7D0"/>
      <rect x="-38" y="93" width="66" height="6" rx="3" fill="#2ED05D"/>
    </g>

    {/* Boy student */}
    <g transform="translate(185,270)">
      <path d="M-10 68 Q-8 88 -8 106" stroke="#2ED05D" strokeWidth="10" strokeLinecap="round" fill="none"/>
      <path d="M10 68 Q8 88 10 106" stroke="#2ED05D" strokeWidth="10" strokeLinecap="round" fill="none"/>
      <ellipse cx="-8" cy="110" rx="9" ry="5" fill="#1F1F1F"/>
      <ellipse cx="10" cy="110" rx="9" ry="5" fill="#1F1F1F"/>
      <ellipse cx="0" cy="38" rx="24" ry="30" fill="#0ea5e9"/>
      <rect x="-6" y="22" width="12" height="10" rx="3" fill="#F9DBBD"/>
      <circle cx="0" cy="8" r="22" fill="#F9DBBD"/>
      <path d="M-22 6 Q-19 -17 0 -19 Q19 -17 22 6 Q14 -7 0 -10 Q-14 -7 -22 6Z" fill="#1F1F1F"/>
      <circle cx="-7" cy="8" r="2.8" fill="#3D2B1F"/>
      <circle cx="7" cy="8" r="2.8" fill="#3D2B1F"/>
      <circle cx="-6" cy="7" r="1" fill="white"/>
      <circle cx="8" cy="7" r="1" fill="white"/>
      <path d="M-5 15 Q0 20 5 15" stroke="#C47C5A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <rect x="-30" y="58" width="52" height="32" rx="4" fill="#0ea5e9"/>
      <rect x="-28" y="60" width="48" height="26" rx="2" fill="#FFE999"/>
      <rect x="-36" y="89" width="64" height="6" rx="3" fill="#0ea5e9"/>
    </g>

    {/* Sparkles */}
    <Sparkle cx={220} cy={72}  r={9}  color="#2ED05D"/>
    <Sparkle cx={285} cy={44}  r={12} color="#0ea5e9"/>
    <Sparkle cx={358} cy={86}  r={7}  color="#2ED05D"/>
    <Sparkle cx={408} cy={148} r={9}  color="#FFB88A"/>
    <Sparkle cx={330} cy={168} r={6}  color="#2ED05D"/>
    <Sparkle cx={172} cy={108} r={8}  color="#0ea5e9"/>
    <Sparkle cx={438} cy={62}  r={10} color="#2ED05D"/>
    <Sparkle cx={248} cy={158} r={6}  color="#FFB88A"/>
  </svg>
);

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError("Please enter your username and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'ERR_NETWORK') {
        setError("Cannot connect to server. Please check your connection.");
      } else {
        setError(err.response?.data?.message || "Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const S = {
    page: {
      minHeight: "100vh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    card: {
      width: "100%",
      maxWidth: "900px",
      borderRadius: "28px",
      overflow: "hidden",
      display: "flex",
      boxShadow: "0 24px 72px rgba(0,0,0,0.06)",
      minHeight: "520px",
    },
    left: {
      flex: "0 0 400px",
      background: "#FFFFFF",
      padding: "52px 48px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    right: {
      flex: 1,
      background: "#2ED05D",
      position: "relative",
      overflow: "hidden",
      minHeight: "520px",
    },
    curve: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    },
    logo: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "38px",
    },
    logoText: {
      fontSize: "21px",
      fontWeight: "800",
      letterSpacing: "4px",
      color: "#1e293b",
      lineHeight: 1,
    },
    logoSub: {
      fontSize: "8.5px",
      letterSpacing: "2.2px",
      color: "#475569",
      marginTop: "3px",
      textTransform: "uppercase",
    },
    heading: {
      fontSize: "21px",
      fontWeight: "700",
      color: "#1e293b",
      marginBottom: "28px",
      lineHeight: 1.3,
    },
    fieldWrap: {
      position: "relative",
      marginBottom: "14px",
    },
    iconLeft: {
      position: "absolute",
      left: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#475569",
      display: "flex",
    },
    input: {
      width: "100%",
      padding: "13px 44px 13px 42px",
      border: "none",
      borderRadius: "16px",
      background: "#f1f5f9",
      color: "#1e293b",
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "inherit",
      transition: "box-shadow .2s",
    },
    eyeBtn: {
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#475569",
      padding: 0,
      display: "flex",
    },
    forgotRow: {
      marginBottom: "28px",
    },
    forgotLink: {
      fontSize: "13px",
      color: "#475569",
      textDecoration: "none",
      cursor: "pointer",
    },
    loginBtn: {
      padding: "13px 36px",
      background: "#2ED05D",
      color: "#fff",
      border: "none",
      borderRadius: "16px",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer",
      letterSpacing: "0.4px",
      fontFamily: "inherit",
      transition: "all .2s",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      minWidth: "120px",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(46,208,93,0.3)",
    },
    error: {
      fontSize: "13px",
      color: "#dc2626",
      marginBottom: "14px",
      padding: "10px 14px",
      background: "#F8E1E4",
      borderRadius: "10px",
      border: "1px solid #f5c6c2",
    },
  };

  return (
    <div style={S.page}>
      <div style={{ ...S.card, opacity: 0, animation: 'scaleIn 0.3s var(--ease-out) forwards' }}>
        <div style={S.left}>
          <div style={{ ...S.logo, opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.1s' }}>
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
              <path d="M23 4 C23 4 13 11 9 22 C14 19 18.5 21 23 21 C27.5 21 32 19 37 22 C33 11 23 4 23 4Z" fill="#2ED05D"/>
              <path d="M9 22 C9 30 14 37 23 41 C32 37 37 30 37 22 C32 19 27.5 21 23 21 C18.5 21 14 19 9 22Z" fill="#2ED05D" opacity="0.72"/>
              <rect x="21" y="39" width="4" height="5" fill="#2ED05D"/>
              <rect x="15" y="43" width="16" height="2.5" rx="1.25" fill="#2ED05D"/>
            </svg>
            <div>
              <div style={S.logoText}>ACADEMIA</div>
              <div style={S.logoSub}>School Management System</div>
            </div>
          </div>

          <div className="eyebrow" style={{ opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.12s', display: 'inline-flex', marginBottom: 10 }}>Access</div>
          <h2 style={{ ...S.heading, opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.15s' }}>Login to your account</h2>

          {error && <div style={S.error}>{error}</div>}

          <div style={{ ...S.fieldWrap, opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.2s' }}>
            <span style={S.iconLeft}><UserIcon /></span>
            <input
              style={S.input}
              type="text"
              placeholder="Username or Email"
              value={form.username}
              onChange={set("username")}
              autoComplete="username"
              onFocus={e => (e.target.style.boxShadow = "0 0 0 2px rgba(46,208,93,0.3)")}
              onBlur={e => (e.target.style.boxShadow = "none")}
            />
          </div>

          <div style={{ ...S.fieldWrap, opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.25s' }}>
            <span style={S.iconLeft}><LockIcon /></span>
            <input
              style={S.input}
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={set("password")}
              autoComplete="current-password"
              onFocus={e => (e.target.style.boxShadow = "0 0 0 2px rgba(46,208,93,0.3)")}
              onBlur={e => (e.target.style.boxShadow = "none")}
            />
            <button style={S.eyeBtn} onClick={() => setShowPass(p => !p)} tabIndex={-1} className="group">
              <span className="flex items-center justify-center">{showPass ? <EyeOff /> : <EyeOpen />}</span>
            </button>
          </div>

          <div style={{ ...S.forgotRow, opacity: 0, animation: 'fadeInUp 0.3s var(--ease-out) forwards', animationDelay: '0.3s' }}>
            <a href="#" style={S.forgotLink}
              onMouseEnter={e => (e.target.style.color = "#2ED05D")}
              onMouseLeave={e => (e.target.style.color = "#475569")}
            >
              Forget password?
            </a>
          </div>

          <button
            style={S.loginBtn}
            className="group"
            onClick={handleLogin}
            disabled={loading}
            onMouseEnter={e => { e.currentTarget.style.background = "#25B04E"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(46,208,93,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#2ED05D"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(46,208,93,0.3)"; }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                  </path>
                </svg>
                Signing in…
              </>
            ) : "Login"}
          </button>
        </div>

        <div style={{ ...S.right, opacity: 0, animation: 'fadeIn 0.3s var(--ease-out) forwards', animationDelay: '0.35s' }}>
          <svg style={S.curve} viewBox="0 0 500 520" preserveAspectRatio="none">
            <path d="M0 0 L290 0 Q248 260 205 520 L0 520 Z" fill="white" opacity="0.52"/>
          </svg>
          <Illustration />
        </div>
      </div>
    </div>
  );
}