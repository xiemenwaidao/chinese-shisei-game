'use client';

import React, { useState, useMemo, useCallback } from 'react';

// 型定義
interface QuizData {
  hanzi: string;
  pinyin: string[];
  pinyinPlain: string[];
  tones: number[];
  word: string;
}

interface ToneOption {
  value: number;
  label: string;
  color: string;
}

interface QuizSettings {
  level: string;
  questionCount: number;
}

interface QuizResult {
  question: QuizData;
  userAnswer: number[];
  isCorrect: boolean;
}


// HSKレベルオプション
const HSK_LEVELS = [
  { value: 'HSK1', label: 'HSK1 (基礎)', color: 'bg-green-700' },
  { value: 'HSK2', label: 'HSK2 (初級)', color: 'bg-blue-700' },
  { value: 'HSK3', label: 'HSK3 (準中級)', color: 'bg-purple-700' },
  { value: 'HSK4', label: 'HSK4 (中級)', color: 'bg-orange-700' },
  { value: 'HSK5', label: 'HSK5 (準上級)', color: 'bg-red-700' },
  { value: 'HSK6', label: 'HSK6 (上級)', color: 'bg-black' },
];

// 出題数オプション
const QUESTION_COUNTS = [5, 10, 15, 20];

// SVGで声調記号を描画するコンポーネント
interface ToneMarkProps {
  tone: number;
  size?: number;
  color?: string;
}

const ToneMark: React.FC<ToneMarkProps> = ({ tone, size = 60, color = 'white' }) => {
  const strokeWidth = 8;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      className="mx-auto"
    >
      {tone === 1 && (
        // 一声: 水平線
        <line
          x1="10"
          y1="30"
          x2="50"
          y2="30"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
      {tone === 2 && (
        // 二声: 上昇線
        <path
          d="M 10 45 Q 30 35, 50 15"
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {tone === 3 && (
        // 三声: V字
        <path
          d="M 10 20 Q 30 50, 50 20"
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {tone === 4 && (
        // 四声: 下降線
        <path
          d="M 10 15 Q 30 35, 50 45"
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {tone === 0 && (
        // 軽声: 小さい丸
        <circle cx="30" cy="30" r="8" fill={color} />
      )}
    </svg>
  );
};

// 正解・不正解アイコン用SVGコンポーネント
interface ResultIconProps {
  isCorrect: boolean;
  size?: number;
}

const ResultIcon: React.FC<ResultIconProps> = ({ isCorrect, size = 80 }) => {
  if (isCorrect) {
    // 正解アイコン（緑の丸に白いチェック）
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="mx-auto">
        <circle cx="50" cy="50" r="45" fill="#10b981" stroke="#059669" strokeWidth="4" />
        <path
          d="M25 50 L40 65 L75 30"
          stroke="white"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  } else {
    // 不正解アイコン（赤い丸に白いX）
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="mx-auto">
        <circle cx="50" cy="50" r="45" fill="#ef4444" stroke="#dc2626" strokeWidth="4" />
        <path
          d="M30 30 L70 70 M70 30 L30 70"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
};

const TONE_OPTIONS: ToneOption[] = [
  { value: 1, label: '一声', color: 'bg-red-700' },
  { value: 2, label: '二声', color: 'bg-yellow-700' },
  { value: 3, label: '三声', color: 'bg-gray-700' },
  { value: 4, label: '四声', color: 'bg-amber-800' },
  { value: 0, label: '軽声', color: 'bg-gray-600' },
];

// 紙吹雪の色を事前に生成
interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  duration: number;
  rotation: number;
}

const ToneQuiz: React.FC = () => {
  // ゲーム設定画面の状態
  const [isSettingMode, setIsSettingMode] = useState<boolean>(true);
  const [settings, setSettings] = useState<QuizSettings>({ level: 'HSK1', questionCount: 10 });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // ゲームの状態
  const [remainingQuestions, setRemainingQuestions] = useState<QuizData[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizData | null>(null);
  const [score, setScore] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [currentCharIndex, setCurrentCharIndex] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [shake, setShake] = useState<boolean>(false);
  const [celebrate, setCelebrate] = useState<boolean>(false);
  const [isGameComplete, setIsGameComplete] = useState<boolean>(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  // 紙吹雪のデータを事前生成（stateベースの種を使用）
  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    if (!celebrate) return [];
    
    const colors = ['bg-red-700', 'bg-yellow-500', 'bg-amber-800', 'bg-red-500', 'bg-yellow-700'];
    // scoreとstreakを基にした擬似ランダムな値を生成
    const seed = score + streak * 1000;
    return Array.from({ length: 30 }, (_, i) => {
      const pseudoRandom1 = ((seed + i * 9973) % 100) / 100;
      const pseudoRandom2 = ((seed + i * 7919) % colors.length);
      const pseudoRandom3 = ((seed + i * 6971) % 100) / 100;
      const pseudoRandom4 = ((seed + i * 5981) % 360);
      
      return {
        id: i,
        left: pseudoRandom1 * 100,
        color: colors[pseudoRandom2],
        duration: 1 + pseudoRandom3,
        rotation: pseudoRandom4,
      };
    });
  }, [celebrate, score, streak]);

  // データ取得関数
  const fetchQuizData = useCallback(async (level: string): Promise<QuizData[]> => {
    const response = await fetch(`/data/${level.toLowerCase()}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${level} data`);
    }
    return response.json();
  }, []);

  // ゲーム開始
  const startGame = useCallback(async (gameSettings: QuizSettings): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    
    try {
      const selectedData = await fetchQuizData(gameSettings.level);
      const shuffled = [...selectedData].sort(() => Math.random() - 0.5);
      const gameQuestions = shuffled.slice(0, Math.min(gameSettings.questionCount, selectedData.length));
      
      setRemainingQuestions([...gameQuestions]);
      setCurrentQuestion(gameQuestions[0] || null);
      setScore(0);
      setTotal(0);
      setUserAnswers([]);
      setShowResult(false);
      setCurrentCharIndex(0);
      setStreak(0);
      setShake(false);
      setCelebrate(false);
      setIsGameComplete(false);
      setQuizResults([]);
      setIsSettingMode(false);
    } catch (error) {
      console.error('Error loading quiz data:', error);
      setLoadError('データの読み込みに失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuizData]);

  const loadNewQuestion = useCallback((newTotal: number = total, isSkipped: boolean = false): void => {
    // スキップされた問題を記録（ゲーム完了チェックより先に実行）
    if (isSkipped && currentQuestion) {
      setQuizResults(prev => {
        const newResults = [...prev, { question: currentQuestion, userAnswer: [], isCorrect: false }];
        return newResults;
      });
    }

    if (newTotal >= settings.questionCount) {
      setIsGameComplete(true);
      return;
    }
    
    const nextQuestions = remainingQuestions.filter(q => q !== currentQuestion);
    if (nextQuestions.length === 0) {
      setIsGameComplete(true);
      return;
    }
    
    const nextQuestion = nextQuestions[0];
    setRemainingQuestions(nextQuestions);
    setCurrentQuestion(nextQuestion);
    setUserAnswers([]);
    setShowResult(false);
    setCurrentCharIndex(0);
  }, [remainingQuestions, currentQuestion, total, settings.questionCount]);

  const handleToneSelect = (toneValue: number): void => {
    if (!currentQuestion || showResult) return;

    const newAnswers = [...userAnswers, toneValue];
    setUserAnswers(newAnswers);

    // 次の文字があれば続ける
    if (currentCharIndex < currentQuestion.tones.length - 1) {
      setCurrentCharIndex(currentCharIndex + 1);
    } else {
      // 全文字入力完了したら結果判定
      checkAllAnswers(newAnswers);
    }
  };

  const checkAllAnswers = (answers: number[]): void => {
    if (!currentQuestion) return;

    setShowResult(true);

    // 全て正解かチェック
    const allCorrect = answers.every(
      (answer, index) => answer === currentQuestion.tones[index],
    );

    // 結果を記録（正解・不正解問わず）
    setQuizResults(prev => {
      const newResults = [...prev, { question: currentQuestion, userAnswer: answers, isCorrect: allCorrect }];
      console.log('Adding result:', currentQuestion.hanzi, 'isCorrect:', allCorrect, 'total results:', newResults.length);
      return newResults;
    });

    if (allCorrect) {
      setStreak(streak + 1);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 600);
    } else {
      setStreak(0);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }

    // 次の問題へ（進行インクリメントはここで実行）
    setTimeout(() => {
      const newTotal = total + 1;
      const newScore = allCorrect ? score + 1 : score;
      setTotal(newTotal);
      setScore(newScore);
      
      // 最後の問題の場合は直接ゲーム完了
      if (newTotal >= settings.questionCount) {
        console.log('Game completed with total results');
        // 結果記録の完了を待つため少し遅延
        setTimeout(() => setIsGameComplete(true), 100);
      } else {
        loadNewQuestion(newTotal, false);
      }
    }, 2000);
  };

  const handleUndo = (): void => {
    setUserAnswers(userAnswers.slice(0, -1));
    setCurrentCharIndex(Math.max(0, currentCharIndex - 1));
  };

  // 設定画面の表示
  if (isSettingMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-800 via-orange-700 to-red-800 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,215,0,0.3)_10px,rgba(255,215,0,0.3)_20px)] pointer-events-none" />
        
        <div className="max-w-[500px] w-full bg-white/95 rounded-[30px] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-[2.5rem] font-black text-red-800 mb-[30px] text-center tracking-[1px] drop-shadow-lg">
            <span className="text-amber-700">早</span>
            <span className="text-red-800">押</span>
            <span className="text-orange-700">し</span>
            <span className="text-red-700">四</span>
            <span className="text-amber-800">声</span>
            <span className="text-orange-800">ク</span>
            <span className="text-red-800">イ</span>
            <span className="text-amber-700">ズ</span>
            <span className="text-3xl ml-2">🎯</span>
          </h1>
          
          <div className="space-y-6">
            {/* 難易度選択 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">難易度を選択</h3>
              <div className="grid grid-cols-2 gap-3">
                {HSK_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setSettings(prev => ({ ...prev, level: level.value }))}
                    className={`p-3 rounded-lg text-white font-semibold transition-all duration-200 hover:-translate-y-1 ${
                      settings.level === level.value 
                        ? level.color + ' scale-105 shadow-lg ring-4 ring-yellow-400 ring-offset-2' 
                        : level.color + ' opacity-70'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 出題数選択 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">出題数を選択</h3>
              <div className="grid grid-cols-4 gap-3">
                {QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setSettings(prev => ({ ...prev, questionCount: count }))}
                    className={`p-3 rounded-lg font-semibold transition-all duration-200 hover:-translate-y-1 ${
                      settings.questionCount === count
                        ? 'bg-amber-800 text-white scale-105 shadow-lg ring-4 ring-yellow-400 ring-offset-2'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {count}問
                  </button>
                ))}
              </div>
            </div>
            
            {/* エラー表示 */}
            {loadError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {loadError}
              </div>
            )}
            
            {/* 開始ボタン */}
            <button
              onClick={() => startGame(settings)}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-red-700 to-red-800 text-white font-bold text-xl rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:-translate-y-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? 'データ読み込み中...' : 'ゲーム開始！'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // ゲーム完了画面
  if (isGameComplete) {
    const accuracyRate = Math.round((score / settings.questionCount) * 100);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-800 via-orange-700 to-red-800 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,215,0,0.3)_10px,rgba(255,215,0,0.3)_20px)] pointer-events-none" />
        
        <div className="max-w-[600px] w-full bg-white/95 rounded-[30px] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h1 className="text-[2.5rem] font-black text-red-800 mb-[20px] text-center tracking-[1px] drop-shadow-lg">
            <span className="text-amber-700">ゲ</span>
            <span className="text-red-800">ー</span>
            <span className="text-orange-700">ム</span>
            <span className="text-red-700">完</span>
            <span className="text-amber-800">了</span>
            <span className="text-orange-800">！</span>
            <span className="text-3xl ml-2">🎉</span>
          </h1>
          
          {/* 結果統計 */}
          <div className="bg-gradient-to-br from-red-700 to-red-800 rounded-[20px] p-6 mb-6 text-center text-white">
            <div className="text-4xl font-bold mb-4">{score}/{settings.questionCount}</div>
            <div className="text-xl font-semibold mb-2">正答率: {accuracyRate}%</div>
            <div className="text-sm opacity-90">{settings.level} • {settings.questionCount}問</div>
          </div>
          
          {/* 全結果一覧 */}
          {quizResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">結果一覧 ({quizResults.length}/{settings.questionCount})</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {quizResults.map((result, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${
                    result.isCorrect 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          result.isCorrect ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {result.isCorrect ? '○' : '×'}
                        </div>
                        <div>
                          <span className="text-2xl font-bold text-gray-800">{result.question.hanzi}</span>
                          <span className="ml-3 text-lg text-gray-700">{result.question.word}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold mb-2 ${
                          result.isCorrect ? 'text-green-700' : 'text-red-700'
                        }`}>あなたの回答:</div>
                        <div className="flex gap-1 justify-end mb-3">
                          {result.userAnswer.length === 0 ? (
                            <div className="bg-gray-500 text-white px-2 py-1 rounded text-xs">
                              スキップ
                            </div>
                          ) : (
                            result.userAnswer.map((ans, idx) => (
                              <div key={idx} className={`text-white px-2 py-1 rounded text-xs flex flex-col items-center ${
                                result.isCorrect ? 'bg-green-600' : 'bg-red-600'
                              }`}>
                                <ToneMark tone={ans} size={20} color="white" />
                                <span>{TONE_OPTIONS.find(opt => opt.value === ans)?.label}</span>
                              </div>
                            ))
                          )}
                        </div>
                        {!result.isCorrect && (
                          <>
                            <div className="text-sm text-green-700 font-semibold mb-2">正解:</div>
                            <div className="flex gap-1 justify-end">
                              {result.question.tones.map((tone, idx) => (
                                <div key={idx} className="bg-green-600 text-white px-2 py-1 rounded text-xs flex flex-col items-center">
                                  <ToneMark tone={tone} size={20} color="white" />
                                  <span>{TONE_OPTIONS.find(opt => opt.value === tone)?.label}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* アクションボタン */}
          <div className="flex gap-3">
            <button
              onClick={() => setIsSettingMode(true)}
              className="flex-1 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-all duration-200"
            >
              設定に戻る
            </button>
            <button
              onClick={() => startGame(settings)}
              disabled={isLoading}
              className="flex-1 py-3 bg-gradient-to-r from-red-700 to-red-800 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '読み込み中...' : 'もう一度プレイ'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const hanziChars = currentQuestion.hanzi.split('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-800 via-orange-700 to-red-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,215,0,0.3)_10px,rgba(255,215,0,0.3)_20px)] pointer-events-none" />

      {/* 紙吹雪エフェクト */}
      {celebrate && (
        <div className="absolute inset-0 pointer-events-none z-[100]">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className={`absolute w-[10px] h-[10px] ${piece.color} rounded-sm animate-fall`}
              style={{
                left: `${piece.left}%`,
                top: '-20px',
                animationDuration: `${piece.duration}s`,
                transform: `rotate(${piece.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* 結果オーバーレイ */}
      {showResult && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`bg-white rounded-3xl p-8 text-center shadow-2xl transform transition-all duration-500 ${
              userAnswers.every((ans, idx) => ans === currentQuestion.tones[idx])
                ? 'border-4 border-green-500'
                : 'border-4 border-red-500'
            }`}
          >
            <div className="mb-4">
              <ResultIcon 
                isCorrect={userAnswers.every((ans, idx) => ans === currentQuestion.tones[idx])}
                size={120}
              />
            </div>
            <div
              className={`text-2xl font-bold mb-2 ${
                userAnswers.every((ans, idx) => ans === currentQuestion.tones[idx])
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}
            >
              {userAnswers.every((ans, idx) => ans === currentQuestion.tones[idx])
                ? '正解！'
                : '不正解'}
            </div>
            <div className="text-lg text-gray-700 font-medium">
              {currentQuestion.hanzi} ({currentQuestion.word})
            </div>
          </div>
        </div>
      )}

      <div
        className={`max-w-[600px] w-full bg-white/95 rounded-[30px] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* ヘッダー */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <button
              onClick={() => setIsSettingMode(true)}
              className="px-2 py-1 text-xs font-semibold border border-gray-400 rounded bg-white text-gray-600 hover:bg-gray-50 transition-all duration-200 z-10 flex-shrink-0"
            >
              ← 設定
            </button>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-gray-500 mb-1">{settings.level}</div>
              <div className="text-sm text-gray-600">{total + 1}/{settings.questionCount}</div>
            </div>
          </div>
          <div className="flex justify-center gap-3 text-sm text-gray-600">
            <div>
              正解: <strong className="text-red-700">{score}</strong>
            </div>
            <div>
              連続:{' '}
              <strong
                className={`${
                  streak >= 3 ? 'text-yellow-600' : 'text-gray-500'
                }`}
              >
                🔥 {streak}
              </strong>
            </div>
          </div>
        </div>

        {/* 問題表示 */}
        <div className="bg-gradient-to-br from-red-700 to-red-800 rounded-[20px] p-6 mb-4 text-center shadow-[0_10px_30px_rgba(220,20,60,0.4)] border-[3px] border-yellow-500">
          {/* 漢字表示 - 現在の文字をハイライト */}
          <div className="text-[4rem] font-bold mb-3 drop-shadow-[0_4px_10px_rgba(0,0,0,0.2)] flex justify-center gap-2">
            {hanziChars.map((char, index) => (
              <span
                key={index}
                className={`inline-block transition-all duration-300 ${
                  index === currentCharIndex
                    ? 'text-yellow-500 scale-[1.2] drop-shadow-[0_0_20px_rgba(255,215,0,0.9)]'
                    : 'text-white scale-100'
                }`}
              >
                {char}
              </span>
            ))}
          </div>

          {/* 拼音表示 - 声調記号なし、現在の部分をハイライト */}
          <div className="text-[1.5rem] mb-2 font-semibold flex justify-center gap-2">
            {currentQuestion.pinyinPlain.map((part, index) => (
              <span
                key={index}
                className={`inline-block transition-all duration-300 ${
                  index === currentCharIndex
                    ? 'text-yellow-500 font-black scale-[1.15] drop-shadow-[0_0_15px_rgba(255,215,0,0.7)]'
                    : 'text-white/90 font-semibold scale-100'
                }`}
              >
                {part}
              </span>
            ))}
          </div>

          <div className="text-base text-white/80 mt-2">
            {currentQuestion.word}
          </div>
        </div>

        {/* 入力済み回答の表示 - 固定高さエリア */}
        <div className="min-h-[70px] mb-4 flex flex-col items-center justify-center">
          {userAnswers.length > 0 && !showResult && (
            <>
              <div className="text-center text-[0.95rem] text-gray-600 mb-[10px]">
                入力済み:{' '}
                {userAnswers.map((ans, idx) => {
                  const option = TONE_OPTIONS.find((opt) => opt.value === ans);
                  return (
                    <span
                      key={idx}
                      className={`inline-block mx-[5px] px-3 py-[5px] text-white rounded-lg font-semibold ${
                        option?.color || 'bg-gray-500'
                      }`}
                    >
                      {hanziChars[idx]} = {option?.label}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={handleUndo}
                className="px-5 py-2 text-[0.85rem] font-semibold border-2 border-amber-800 rounded-[20px] bg-white text-amber-800 transition-all duration-200 hover:bg-amber-800 hover:text-white"
              >
                ← 取り消し
              </button>
            </>
          )}
        </div>

        {/* 選択肢 */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3 mb-4">
          {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleToneSelect(option.value)}
                disabled={showResult}
                className={`px-2 py-3 rounded-lg text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)] flex flex-col items-center gap-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] active:-translate-y-0 ${
                  option.color
                } ${showResult ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
              >
                <ToneMark tone={option.value} size={40} />
                <div className="text-xs font-semibold opacity-90">
                  {option.label}
                </div>
              </button>
          ))}
        </div>

        {/* スキップボタン */}
        <div className="text-center mt-4">
          <button
            onClick={() => {
              const newTotal = total + 1;
              setTotal(newTotal);
              loadNewQuestion(newTotal, true);
            }}
            disabled={showResult}
            className="px-6 py-2 text-sm font-semibold border-2 border-red-700 rounded-full bg-white text-red-700 transition-all duration-200 hover:bg-red-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次の問題へ ⏭
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToneQuiz;