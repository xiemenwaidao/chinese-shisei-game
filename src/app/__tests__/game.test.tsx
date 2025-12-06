import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ToneQuiz from '../game';

// JSONファイルのモック
const mockHsk1Data = [
  {
    hanzi: "你好",
    pinyin: ["nǐ", "hǎo"],
    pinyinPlain: ["ni", "hao"],
    tones: [3, 3],
    word: "こんにちは"
  },
  {
    hanzi: "谢谢",
    pinyin: ["xiè", "xie"],
    pinyinPlain: ["xie", "xie"],
    tones: [4, 0],
    word: "ありがとう"
  },
  {
    hanzi: "中国",
    pinyin: ["zhōng", "guó"],
    pinyinPlain: ["zhong", "guo"],
    tones: [1, 2],
    word: "中国"
  },
  {
    hanzi: "学习",
    pinyin: ["xué", "xí"],
    pinyinPlain: ["xue", "xi"],
    tones: [2, 2],
    word: "勉強する"
  },
  {
    hanzi: "咖啡",
    pinyin: ["kā", "fēi"],
    pinyinPlain: ["ka", "fei"],
    tones: [1, 1],
    word: "コーヒー"
  }
];

// fetch APIのモック
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockImplementation(async (url) => {
    if (typeof url === 'string' && url.includes('/data/hsk1.json')) {
      return {
        ok: true,
        json: async () => mockHsk1Data,
      } as Response;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

describe('ToneQuiz Game', () => {
  test('設定画面が正しく表示される', () => {
    render(<ToneQuiz />);
    
    // タイトルは個別の文字で分割されているので、各文字を確認
    expect(screen.getByText('早')).toBeInTheDocument();
    expect(screen.getByText('押')).toBeInTheDocument();
    expect(screen.getByText('し')).toBeInTheDocument();
    expect(screen.getByText('四')).toBeInTheDocument();
    expect(screen.getByText('声')).toBeInTheDocument();
    expect(screen.getByText('ク')).toBeInTheDocument();
    expect(screen.getByText('イ')).toBeInTheDocument();
    expect(screen.getByText('ズ')).toBeInTheDocument();
    
    expect(screen.getByText('難易度を選択')).toBeInTheDocument();
    expect(screen.getByText('出題数を選択')).toBeInTheDocument();
    expect(screen.getByText('ゲーム開始！')).toBeInTheDocument();
  });

  test('5問設定でゲームを完了すると5つの結果が表示される', async () => {
    render(<ToneQuiz />);
    
    // 5問設定を選択
    fireEvent.click(screen.getByText('5問'));
    
    // ゲーム開始
    fireEvent.click(screen.getByText('ゲーム開始！'));
    
    // データ読み込み完了を待つ（ゲーム画面に移行したことを確認）
    await waitFor(() => {
      // ゲーム画面特有のUIが表示されることを確認
      expect(screen.getByText('← 設定')).toBeInTheDocument();
      expect(screen.getByText(/\d+\/5/)).toBeInTheDocument(); // 問題数表示
    }, { timeout: 10000 });

    // 5問すべてを回答（ランダムに出題されるのでスキップで進める）
    for (let i = 0; i < 5; i++) {
      // スキップボタンをクリック（より確実に次へ進む）
      const skipButton = screen.getByText(/次の問題へ/);
      fireEvent.click(skipButton);
      
      // 最後の問題でない場合は次の問題への遷移を待つ
      if (i < 4) {
        await waitFor(() => {
          expect(screen.getByText(/\d+\/5/)).toBeInTheDocument();
        }, { timeout: 3000 });
      }
    }
    
    // 結果画面の表示を待つ（文字が分割されているので個別確認）
    await waitFor(() => {
      expect(screen.getByText('ゲ')).toBeInTheDocument();
      expect(screen.getByText('完')).toBeInTheDocument();
      expect(screen.getByText('了')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // 5つの結果がすべて表示されることを確認
    await waitFor(() => {
      const resultTitle = screen.getByText(/結果一覧 \((\d+)\/5\)/);
      expect(resultTitle.textContent).toBe('結果一覧 (5/5)');
    });
    
    // スキップした5問がすべて結果に表示されることを確認
    const skipLabels = screen.getAllByText('スキップ');
    expect(skipLabels).toHaveLength(5);
  });

  test('スキップした問題が結果一覧に表示される', async () => {
    render(<ToneQuiz />);
    
    // テストで3問設定がないので5問を選択
    fireEvent.click(screen.getByText('5問'));
    
    // ゲーム開始
    fireEvent.click(screen.getByText('ゲーム開始！'));
    
    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.getByText('学')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 1問目をスキップ
    fireEvent.click(screen.getByText(/次の問題へ/));
    
    // 2-5問目をすべて正解で進める
    for (let i = 1; i < 5; i++) {
      const currentProblem = mockHsk1Data[i];
      
      // 次の問題の文字が表示されるのを待つ
      const nextCharacters = currentProblem.hanzi.split('');
      await waitFor(() => {
        expect(screen.getByText(nextCharacters[0])).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // 正解で回答
      for (let j = 0; j < currentProblem.tones.length; j++) {
        const tone = currentProblem.tones[j];
        const toneButtonText = tone === 0 ? '軽声' : 
          tone === 1 ? '一声' : 
          tone === 2 ? '二声' : 
          tone === 3 ? '三声' : '四声';
        
        fireEvent.click(screen.getByText(toneButtonText));
      }
      
      // 最後の問題以外は次への遷移を待つ
      if (i < 4) {
        await waitFor(() => {
          expect(screen.getByText('○ 正解！')).toBeInTheDocument();
        }, { timeout: 2000 });
      }
    }
    
    // 結果画面の表示を待つ
    await waitFor(() => {
      expect(screen.getByText('ゲーム完了！')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // 5つの結果がすべて表示されることを確認
    await waitFor(() => {
      const resultTitle = screen.getByText(/結果一覧 \((\d+)\/5\)/);
      expect(resultTitle.textContent).toBe('結果一覧 (5/5)');
    });
    
    // スキップした問題に「スキップ」表示があることを確認
    expect(screen.getByText('スキップ')).toBeInTheDocument();
  });

  test('間違えた問題が結果一覧に表示される', async () => {
    render(<ToneQuiz />);
    
    // テストで2問設定がないので5問を選択
    fireEvent.click(screen.getByText('5問'));
    
    // ゲーム開始
    fireEvent.click(screen.getByText('ゲーム開始！'));
    
    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.getByText('学')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 1問目を間違える（学习は[2,2]なのに[1,1]で回答）
    fireEvent.click(screen.getByText('一声'));
    fireEvent.click(screen.getByText('一声'));
    
    // 2-5問目をすべて正解で進める
    for (let i = 1; i < 5; i++) {
      const currentProblem = mockHsk1Data[i];
      
      // 次の問題の文字が表示されるのを待つ
      const nextCharacters = currentProblem.hanzi.split('');
      await waitFor(() => {
        expect(screen.getByText(nextCharacters[0])).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // 正解で回答
      for (let j = 0; j < currentProblem.tones.length; j++) {
        const tone = currentProblem.tones[j];
        const toneButtonText = tone === 0 ? '軽声' : 
          tone === 1 ? '一声' : 
          tone === 2 ? '二声' : 
          tone === 3 ? '三声' : '四声';
        
        fireEvent.click(screen.getByText(toneButtonText));
      }
      
      // 最後の問題以外は次への遷移を待つ
      if (i < 4) {
        await waitFor(() => {
          expect(screen.getByText('○ 正解！')).toBeInTheDocument();
        }, { timeout: 2000 });
      }
    }
    
    // 結果画面の表示を待つ
    await waitFor(() => {
      expect(screen.getByText('ゲーム完了！')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // 5つの結果がすべて表示されることを確認
    await waitFor(() => {
      const resultTitle = screen.getByText(/結果一覧 \((\d+)\/5\)/);
      expect(resultTitle.textContent).toBe('結果一覧 (5/5)');
    });
    
    // 正解・不正解の表示を確認（1問目は間違い、残り4問は正解）
    const correctMarks = screen.getAllByText('○');
    const incorrectMarks = screen.getAllByText('×');
    
    expect(correctMarks).toHaveLength(4); // 2-5問目が正解
    expect(incorrectMarks).toHaveLength(1); // 1問目が不正解
  });

  test('結果画面からもう一度プレイできる', async () => {
    render(<ToneQuiz />);
    
    // テストで1問設定がないので5問を選択
    fireEvent.click(screen.getByText('5問'));
    
    // ゲーム開始
    fireEvent.click(screen.getByText('ゲーム開始！'));
    
    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.getByText('学')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 5問すべてを正解
    for (let i = 0; i < 5; i++) {
      const currentProblem = mockHsk1Data[i];
      
      // 正解で回答
      for (let j = 0; j < currentProblem.tones.length; j++) {
        const tone = currentProblem.tones[j];
        const toneButtonText = tone === 0 ? '軽声' : 
          tone === 1 ? '一声' : 
          tone === 2 ? '二声' : 
          tone === 3 ? '三声' : '四声';
        
        fireEvent.click(screen.getByText(toneButtonText));
      }
      
      // 最後の問題以外は次への遷移を待つ
      if (i < 4) {
        await waitFor(() => {
          expect(screen.getByText('○ 正解！')).toBeInTheDocument();
        }, { timeout: 2000 });
        
        // 次の問題への遷移を待つ
        const nextProblem = mockHsk1Data[i + 1];
        const nextCharacters = nextProblem.hanzi.split('');
        await waitFor(() => {
          expect(screen.getByText(nextCharacters[0])).toBeInTheDocument();
        }, { timeout: 3000 });
      }
    }
    
    // 結果画面の表示を待つ
    await waitFor(() => {
      expect(screen.getByText('ゲーム完了！')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // もう一度プレイボタンをクリック
    fireEvent.click(screen.getByText('もう一度プレイ'));
    
    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.getByText('学')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});