import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarCog, Lock, TriangleAlert } from "lucide-react";
import { calcDateByRule, findNextAvailableDate, getJapanHolidaySet } from "./utils/dateUtils";

type VacationType = "full" | "half" | "temporary";
type VacationRecord = { id: string; date: string; type: VacationType };
type CongestionRecord = { id: string; date: string };
type AdminTab = "vacation" | "congestion";

type MenuRule = {
  id: string;
  label: string;
  recommended: { kind: "weeks" | "months"; value: number };
  deadline: { kind: "weeks" | "months"; value: number };
};

const ADMIN_PASSWORD = "00000000";
const STORAGE_KEYS = {
  vacations: "fl-calendar-vacations",
  congestions: "fl-calendar-congestions",
  adminPassword: "fl-calendar-admin-password",
};

const MENU_RULES: MenuRule[] = [
  {
    id: "ext-wax",
    label: "エクステ / 眉毛ワックス",
    recommended: { kind: "weeks", value: 3 },
    deadline: { kind: "months", value: 1 },
  },
  {
    id: "led-ext",
    label: "LEDエクステ",
    recommended: { kind: "weeks", value: 4 },
    deadline: { kind: "weeks", value: 6 },
  },
  {
    id: "lash-perm",
    label: "まつげパーマ",
    recommended: { kind: "weeks", value: 4 },
    deadline: { kind: "months", value: 2 },
  },
  {
    id: "simplifi",
    label: "シンプリフィ",
    recommended: { kind: "weeks", value: 5 },
    deadline: { kind: "months", value: 2 },
  },
  {
    id: "healthy-exlift",
    label: "＆Healthy / ExLift",
    recommended: { kind: "months", value: 1 },
    deadline: { kind: "weeks", value: 6 },
  },
];

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function App() {
  const today = new Date();
  const [selectedMenu, setSelectedMenu] = useState<string>(MENU_RULES[0].id);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminCredential, setAdminCredential] = useState(ADMIN_PASSWORD);
  const [authError, setAuthError] = useState("");
  const [adminTab, setAdminTab] = useState<AdminTab>("vacation");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordUpdateMessage, setPasswordUpdateMessage] = useState("");
  const [passwordUpdateError, setPasswordUpdateError] = useState("");
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);

  const [vacations, setVacations] = useState<VacationRecord[]>([]);
  const [congestions, setCongestions] = useState<CongestionRecord[]>([]);

  const [vacationDate, setVacationDate] = useState(format(today, "yyyy-MM-dd"));
  const [vacationType, setVacationType] = useState<VacationType>("full");
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);

  const [congestionDate, setCongestionDate] = useState(format(today, "yyyy-MM-dd"));
  const [editingCongestionId, setEditingCongestionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const vacationRaw = localStorage.getItem(STORAGE_KEYS.vacations);
      const congestionRaw = localStorage.getItem(STORAGE_KEYS.congestions);
      if (vacationRaw) {
        setVacations(JSON.parse(vacationRaw) as VacationRecord[]);
      }
      if (congestionRaw) {
        setCongestions(JSON.parse(congestionRaw) as CongestionRecord[]);
      }
      const savedAdminPassword = localStorage.getItem(STORAGE_KEYS.adminPassword);
      if (savedAdminPassword) {
        setAdminCredential(savedAdminPassword);
      } else {
        localStorage.setItem(STORAGE_KEYS.adminPassword, ADMIN_PASSWORD);
      }
    } catch {
      setVacations([]);
      setCongestions([]);
      setAdminCredential(ADMIN_PASSWORD);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.vacations, JSON.stringify(vacations));
  }, [vacations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.congestions, JSON.stringify(congestions));
  }, [congestions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.adminPassword, adminCredential);
  }, [adminCredential]);

  const vacationByDate = useMemo(() => {
    const map = new Map<string, VacationRecord[]>();
    vacations.forEach((v) => {
      const list = map.get(v.date) ?? [];
      list.push(v);
      map.set(v.date, list);
    });
    return map;
  }, [vacations]);

  const fullVacationSet = useMemo(() => {
    const set = new Set<string>();
    vacations.forEach((v) => {
      if (v.type === "full") set.add(v.date);
    });
    return set;
  }, [vacations]);

  const congestionSet = useMemo(() => new Set(congestions.map((c) => c.date)), [congestions]);

  const selectedRule = MENU_RULES.find((r) => r.id === selectedMenu) ?? MENU_RULES[0];

  const recommendedDate = useMemo(() => {
    const draft = calcDateByRule(today, selectedRule.recommended);
    return findNextAvailableDate(draft, fullVacationSet);
  }, [today, selectedRule, fullVacationSet]);

  const deadlineDate = useMemo(() => {
    const draft = calcDateByRule(today, selectedRule.deadline);
    return findNextAvailableDate(draft, fullVacationSet);
  }, [today, selectedRule, fullVacationSet]);

  const monthStarts = useMemo(
    () => [startOfMonth(today), startOfMonth(addMonths(today, 1)), startOfMonth(addMonths(today, 2))],
    [today],
  );
  const holidaySet = useMemo(() => {
    const years = new Set(monthStarts.map((d) => d.getFullYear()));
    const merged = new Set<string>();
    years.forEach((year) => {
      getJapanHolidaySet(year).forEach((key) => merged.add(key));
    });
    return merged;
  }, [monthStarts]);

  const saveVacation = () => {
    if (!vacationDate) return;
    if (editingVacationId) {
      setVacations((prev) =>
        prev.map((v) =>
          v.id === editingVacationId ? { ...v, date: vacationDate, type: vacationType } : v,
        ),
      );
      setEditingVacationId(null);
    } else {
      setVacations((prev) => [...prev, { id: createId(), date: vacationDate, type: vacationType }]);
    }
  };

  const saveCongestion = () => {
    if (!congestionDate) return;
    if (editingCongestionId) {
      setCongestions((prev) =>
        prev.map((c) => (c.id === editingCongestionId ? { ...c, date: congestionDate } : c)),
      );
      setEditingCongestionId(null);
    } else {
      setCongestions((prev) => [...prev, { id: createId(), date: congestionDate }]);
    }
  };

  const handleAdminAuth = () => {
    if (adminPassword === adminCredential) {
      setIsAuthOpen(false);
      setIsAdminOpen(true);
      setAuthError("");
      setAdminPassword("");
    } else {
      setAuthError("パスワードが正しくありません。");
    }
  };

  const updateAdminPassword = () => {
    setPasswordUpdateMessage("");
    setPasswordUpdateError("");
    if (currentPasswordInput !== adminCredential) {
      setPasswordUpdateError("現在のパスワードが一致しません。");
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 4) {
      setPasswordUpdateError("新しいパスワードは4文字以上で入力してください。");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordUpdateError("新しいパスワード（確認）が一致しません。");
      return;
    }
    setAdminCredential(newPasswordInput);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordUpdateMessage("パスワードを変更しました。");
  };

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto min-h-screen w-full max-w-[980px] px-5 pb-28 pt-6 md:px-8">
      <header className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">FLカレンダー</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">メニュー選択</span>
            <select
              value={selectedMenu}
              onChange={(e) => setSelectedMenu(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
            >
              {MENU_RULES.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
            <div className="font-semibold text-emerald-700">おすすめ日（◎）</div>
            <div>{format(recommendedDate, "yyyy/MM/dd(E)", { locale: ja })}</div>
          </div>
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm">
            <div className="font-semibold text-indigo-700">期限日（〇）</div>
            <div>{format(deadlineDate, "yyyy/MM/dd(E)", { locale: ja })}</div>
          </div>
        </div>
      </header>

      <main className="space-y-4">
        {monthStarts.map((monthStart, idx) => {
          const monthLabel = idx === 0 ? "当月" : idx === 1 ? "翌月" : "翌々月";
          const start = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 0 });
          const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
          const days = eachDayOfInterval({ start, end });

          return (
            <section key={monthLabel} className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
              <h2 className="mb-3 text-xl font-bold">
                {monthLabel}：{format(monthStart, "yyyy年M月", { locale: ja })}
              </h2>
              <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-slate-500">
                {WEEK_LABELS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const records = vacationByDate.get(key) ?? [];
                  const isFull = records.some((r) => r.type === "full");
                  const isHalf = records.some((r) => r.type === "half");
                  const isTemp = records.some((r) => r.type === "temporary");
                  const isCongested = congestionSet.has(key);
                  const isRecommended = isSameDay(day, recommendedDate);
                  const isDeadline = isSameDay(day, deadlineDate);
                  const isToday = isSameDay(day, today);
                  const isSunday = day.getDay() === 0;
                  const isSaturday = day.getDay() === 6;
                  const isHoliday = holidaySet.has(key);
                  const inCurrentMonth = isSameMonth(day, monthStart);

                  const baseCell =
                    "relative min-h-[84px] rounded-xl border p-2 text-left transition-colors md:min-h-[92px]";
                  const cellClass = [
                    baseCell,
                    inCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50",
                    isFull ? "bg-slate-300 text-slate-500" : "",
                  ].join(" ");

                  return (
                    <div
                      key={key}
                      className={cellClass}
                      style={
                        !isFull && isHalf
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, transparent 0%, transparent 48%, rgba(148,163,184,.35) 48%, rgba(148,163,184,.35) 100%)",
                            }
                          : !isFull && isToday
                            ? { backgroundColor: "rgba(251, 113, 133, 0.15)" }
                          : undefined
                      }
                    >
                      <div
                        className={`text-sm font-semibold ${
                          isToday
                            ? "text-black"
                            : isSunday || isHoliday
                              ? "text-rose-600"
                              : isSaturday
                                ? "text-blue-600"
                                : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[0.8rem] leading-none">
                        {isRecommended && (
                          <span className="rounded bg-emerald-100 px-[0.4rem] py-[0.2rem] font-bold">◎</span>
                        )}
                        {isDeadline && (
                          <span className="rounded bg-indigo-100 px-[0.4rem] py-[0.2rem] font-bold">〇</span>
                        )}
                        {isCongested && (
                          <span className="rounded bg-amber-100 px-[0.4rem] py-[0.2rem] font-bold">△</span>
                        )}
                        {isTemp && (
                          <span className="inline-flex items-center rounded bg-rose-100 px-[0.4rem] py-[0.2rem] font-bold text-rose-700">
                            <TriangleAlert size={16} strokeWidth={2.75} className="mr-0.5" />!
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <button
        onClick={() => {
          setIsAuthOpen(true);
          setIsPasswordChangeOpen(false);
          setPasswordUpdateMessage("");
          setPasswordUpdateError("");
        }}
        className="fixed bottom-5 right-5 flex min-h-12 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white shadow-lg"
      >
        <CalendarCog size={16} strokeWidth={2.75} />
        管理者
      </button>

      {isAuthOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
            {!isPasswordChangeOpen ? (
              <>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <Lock size={14} strokeWidth={2.75} />
                  管理者認証
                </h3>
                <p className="mb-2 text-sm text-slate-600">ログイン</p>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="パスワード"
                  className="mb-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"
                />
                {authError && <p className="mb-2 text-sm text-rose-600">{authError}</p>}
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={handleAdminAuth}
                    className="min-h-11 flex-1 rounded-lg bg-slate-900 px-4 text-white"
                  >
                    ログイン
                  </button>
                  <button
                    onClick={() => {
                      setIsAuthOpen(false);
                      setIsPasswordChangeOpen(false);
                      setAuthError("");
                      setAdminPassword("");
                      setCurrentPasswordInput("");
                      setNewPasswordInput("");
                      setConfirmPasswordInput("");
                      setPasswordUpdateMessage("");
                      setPasswordUpdateError("");
                    }}
                    className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4"
                  >
                    キャンセル
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordChangeOpen(true);
                    setPasswordUpdateMessage("");
                    setPasswordUpdateError("");
                    setAuthError("");
                  }}
                  className="min-h-11 w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-800"
                >
                  パスワード変更
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <Lock size={14} strokeWidth={2.75} />
                    パスワード変更
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordChangeOpen(false);
                      setCurrentPasswordInput("");
                      setNewPasswordInput("");
                      setConfirmPasswordInput("");
                      setPasswordUpdateMessage("");
                      setPasswordUpdateError("");
                    }}
                    className="min-h-10 shrink-0 rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    ログインに戻る
                  </button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  現在のパスワードで確認後、新しいパスワードに更新できます。
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="現在のパスワード"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
                  />
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="新しいパスワード"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
                  />
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="新しいパスワード（確認）"
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
                  />
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={updateAdminPassword}
                    className="min-h-11 rounded-lg bg-slate-800 px-4 text-white"
                  >
                    変更を保存
                  </button>
                  {passwordUpdateMessage && (
                    <span className="text-sm text-emerald-700">{passwordUpdateMessage}</span>
                  )}
                  {passwordUpdateError && <span className="text-sm text-rose-600">{passwordUpdateError}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAuthOpen(false);
                    setIsPasswordChangeOpen(false);
                    setAuthError("");
                    setAdminPassword("");
                    setCurrentPasswordInput("");
                    setNewPasswordInput("");
                    setConfirmPasswordInput("");
                    setPasswordUpdateMessage("");
                    setPasswordUpdateError("");
                  }}
                  className="mt-4 min-h-11 w-full rounded-lg border border-slate-300 px-4 text-sm"
                >
                  閉じる
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isAdminOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-4 md:p-8">
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-bold">管理者メニュー</h3>
              <button
                onClick={() => setIsAdminOpen(false)}
                className="min-h-11 rounded-lg border border-slate-300 px-4"
              >
                閉じる
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setAdminTab("vacation")}
                className={`min-h-11 rounded-lg px-4 ${
                  adminTab === "vacation" ? "bg-slate-900 text-white" : "border border-slate-300"
                }`}
              >
                休暇設定
              </button>
              <button
                onClick={() => setAdminTab("congestion")}
                className={`min-h-11 rounded-lg px-4 ${
                  adminTab === "congestion" ? "bg-slate-900 text-white" : "border border-slate-300"
                }`}
              >
                混雑設定
              </button>
            </div>

            {adminTab === "vacation" ? (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="date"
                    value={vacationDate}
                    onChange={(e) => setVacationDate(e.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                  />
                  <select
                    value={vacationType}
                    onChange={(e) => setVacationType(e.target.value as VacationType)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                  >
                    <option value="full">全休</option>
                    <option value="half">半休</option>
                    <option value="temporary">仮休暇</option>
                  </select>
                  <button
                    onClick={saveVacation}
                    className="min-h-11 rounded-lg bg-emerald-600 px-4 text-white"
                  >
                    {editingVacationId ? "更新" : "保存"}
                  </button>
                </div>
                <ul className="space-y-2">
                  {vacations.length === 0 && <li className="text-sm text-slate-500">登録はありません。</li>}
                  {vacations
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2"
                      >
                        <span className="text-sm">
                          {v.date} / {v.type === "full" ? "全休" : v.type === "half" ? "半休" : "仮休暇"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingVacationId(v.id);
                              setVacationDate(v.date);
                              setVacationType(v.type);
                            }}
                            className="min-h-10 rounded-md border border-slate-300 px-3 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setVacations((prev) => prev.filter((item) => item.id !== v.id))}
                            className="min-h-10 rounded-md bg-rose-600 px-3 text-sm text-white"
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    type="date"
                    value={congestionDate}
                    onChange={(e) => setCongestionDate(e.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                  />
                  <button
                    onClick={saveCongestion}
                    className="min-h-11 rounded-lg bg-amber-500 px-4 text-white"
                  >
                    {editingCongestionId ? "更新" : "保存"}
                  </button>
                </div>
                <ul className="space-y-2">
                  {congestions.length === 0 && <li className="text-sm text-slate-500">登録はありません。</li>}
                  {congestions
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2"
                      >
                        <span className="text-sm">{c.date}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingCongestionId(c.id);
                              setCongestionDate(c.date);
                            }}
                            className="min-h-10 rounded-md border border-slate-300 px-3 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setCongestions((prev) => prev.filter((item) => item.id !== c.id))}
                            className="min-h-10 rounded-md bg-rose-600 px-3 text-sm text-white"
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
