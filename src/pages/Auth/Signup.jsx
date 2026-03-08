import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import "./signup.css";
import { registerCompany } from "../../services/monitoringApi.js";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone1: "010",
    phone2: "",
    phone3: "",
    email: "",
    pw: "",
    pw2: "",
    company: "",
    companyIp: "",
    birthY: "",
    birthM: "",
    birthD: "",
  });

  const [agree, setAgree] = useState({
    all: false,
    terms: false,
    privacy: false,
    marketing: false,
    sms: false,
    email: false,
  });

  const [touched, setTouched] = useState({
    phone: false,
    pw2: false,
  });

  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const requiredOk = useMemo(() => agree.terms && agree.privacy, [agree]);

  const phoneValid = useMemo(() => {
    return form.phone2.length === 4 && form.phone3.length === 4;
  }, [form.phone2, form.phone3]);

  const pwMatch = useMemo(() => {
    if (!form.pw2) return null;
    return form.pw === form.pw2;
  }, [form.pw, form.pw2]);

  const onToggleAll = (checked) => {
    setAgree({
      all: checked,
      terms: checked,
      privacy: checked,
      marketing: checked,
      sms: checked,
      email: checked,
    });
  };

  const onToggle = (key, checked) => {
    setAgree((p) => {
      const next = { ...p, [key]: checked };
      const allOn = next.terms && next.privacy && next.marketing && next.sms && next.email;
      return { ...next, all: allOn };
    });
  };

  const validateBeforeSubmit = () => {
    setSubmitError("");

    if (!form.name.trim()) return "이름을 입력해주세요.";
    if (!phoneValid) return "전화번호는 8자리(4자리-4자리)로 정확히 입력해주세요.";
    if (!form.email.trim()) return "이메일(ID)을 입력해주세요.";
    if (!form.pw) return "비밀번호를 입력해주세요.";
    if (!form.pw2) return "비밀번호 확인을 입력해주세요.";
    if (form.pw !== form.pw2) return "비밀번호가 일치하지 않습니다.";
    if (!form.company.trim()) return "회사명을 입력해주세요.";
    if (!form.companyIp.trim()) return "회사 IP를 입력해주세요.";
    if (!requiredOk) return "필수 약관에 동의해주세요.";

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTouched((p) => ({ ...p, phone: true, pw2: true }));

    const msg = validateBeforeSubmit();
    if (msg) {
      setSubmitError(msg);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      await registerCompany({
        name: form.company.trim(),
        email: form.email.trim(),
        password: form.pw,
        ip: form.companyIp.trim(),
        phone: `${form.phone1}-${form.phone2}-${form.phone3}`,
      });

      alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
      navigate("/login", { replace: true });
    } catch (err) {
      setSubmitError(err?.message || "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="authWrapper">
      <div className="authCard authCard--signup">
        <div className="authRight authRight--signup">
          <h1 className="authTitle">회원가입</h1>

          <form className="signupForm" onSubmit={handleSubmit}>
            <Field label="이름" required>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </Field>

            <Field label="전화번호" required>
              <div className="phoneRow">
                <select value={form.phone1} onChange={(e) => setField("phone1", e.target.value)}>
                  <option value="010">010</option>
                  <option value="011">011</option>
                  <option value="016">016</option>
                  <option value="017">017</option>
                  <option value="018">018</option>
                  <option value="019">019</option>
                </select>

                <span className="dash">-</span>

                <input
                  value={form.phone2}
                  onChange={(e) =>
                    setField("phone2", e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                  inputMode="numeric"
                  required
                />

                <span className="dash">-</span>

                <input
                  value={form.phone3}
                  onChange={(e) =>
                    setField("phone3", e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                  inputMode="numeric"
                  required
                />
              </div>

              {touched.phone && !phoneValid && (
                <p className="errorText">전화번호는 8자리(4자리-4자리)로 입력해주세요.</p>
              )}
            </Field>

            <Field label="이메일 (ID)" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
            </Field>

            <Field label="비밀번호" required>
              <input
                type="password"
                value={form.pw}
                onChange={(e) => setField("pw", e.target.value)}
                required
              />
              <p className="hint">영문/숫자/특수문자 포함 8자 이상 권장</p>
            </Field>

            <Field label="비밀번호 확인" required>
              <input
                type="password"
                value={form.pw2}
                onChange={(e) => setField("pw2", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, pw2: true }))}
                required
              />

              {touched.pw2 && pwMatch === true && <p className="okText">확인!</p>}
              {touched.pw2 && pwMatch === false && (
                <p className="errorText">비밀번호가 일치하지 않습니다.</p>
              )}
            </Field>

            <Field label="회사명" required>
              <input
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
                required
              />
            </Field>

            <Field label="회사 IP" required>
              <input
                placeholder="예: 192.168.0.1"
                value={form.companyIp}
                onChange={(e) => setField("companyIp", e.target.value)}
                required
              />
            </Field>

            <Field label="생년월일">
              <div className="birthRow">
                <input
                  placeholder="YYYY"
                  value={form.birthY}
                  onChange={(e) => setField("birthY", e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                <input
                  placeholder="MM"
                  value={form.birthM}
                  onChange={(e) => setField("birthM", e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
                <input
                  placeholder="DD"
                  value={form.birthD}
                  onChange={(e) => setField("birthD", e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            </Field>

            <div className="agreeBox">
              <label className="checkRow checkRow--all">
                <span>전체 동의</span>
                <input
                  type="checkbox"
                  checked={agree.all}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </label>

              <div className="agreeList">
                <AgreeRow
                  label="[필수] 이용약관 동의"
                  checked={agree.terms}
                  onChange={(v) => onToggle("terms", v)}
                />
                <AgreeRow
                  label="[필수] 개인정보처리방침 동의"
                  checked={agree.privacy}
                  onChange={(v) => onToggle("privacy", v)}
                />
                <AgreeRow
                  label="[선택] 수신 동의"
                  checked={agree.marketing}
                  onChange={(v) => onToggle("marketing", v)}
                />
                <AgreeRow
                  label="SMS 수신 동의"
                  checked={agree.sms}
                  onChange={(v) => onToggle("sms", v)}
                  isSub
                />
                <AgreeRow
                  label="이메일 수신 동의"
                  checked={agree.email}
                  onChange={(v) => onToggle("email", v)}
                  isSub
                />
              </div>
            </div>

            {submitError ? <div className="submitError">{submitError}</div> : null}

            <button type="submit" className="authBtn primary" disabled={!requiredOk || submitting}>
              {submitting ? "회원가입 중..." : "회원가입"}
            </button>

            <button
              type="button"
              className="authBack"
              onClick={() => navigate("/login")}
              disabled={submitting}
            >
              ← 로그인으로
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="field">
      <div className="fieldLabel">
        {label} {required ? <span className="req">*</span> : null}
      </div>
      {children}
    </div>
  );
}

function AgreeRow({ label, checked, onChange, isSub }) {
  return (
    <label className={`checkRow ${isSub ? "checkRow--sub" : ""}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}