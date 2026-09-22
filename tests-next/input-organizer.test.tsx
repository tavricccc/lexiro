import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import { AiRequestError } from "@/src/lib/ai/errors";
const send = vi.hoisted(() => vi.fn());
const managedFetch = vi.hoisted(() => vi.fn());
const readManagedStream = vi.hoisted(() => vi.fn());
const encodeWordPhoto = vi.hoisted(() => vi.fn());
const encodeWebp = vi.hoisted(() => vi.fn());
vi.mock("@/stores/cloud-store", () => ({
  useCloudStore: (select: (value: { user: { uid: string } }) => unknown) =>
    select({ user: { uid: "user" } }),
}));
vi.mock("@/lib/managed-client", () => ({
  managedTurn: send,
  managedFetch,
  readManagedStream,
}));
vi.mock("@/lib/word-photo", () => ({ encodeWordPhoto }));
vi.mock("@jsquash/webp", () => ({ encode: encodeWebp }));
beforeEach(() => {
  vi.clearAllMocks();
  managedFetch.mockResolvedValue({});
  encodeWordPhoto.mockResolvedValue("encoded-photo");
  encodeWebp.mockResolvedValue(
    new TextEncoder().encode("RIFFxxxxWEBPencoded").buffer,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The page around the organizer owns which step is showing. */
function Host({ onConfirm }: { onConfirm: (text: string) => void }) {
  const [phase, setPhase] = useState<OrganizerPhase>("input");
  return (
    <InputOrganizer onConfirm={onConfirm} onPhase={setPhase} phase={phase} />
  );
}

describe("organize before generating", () => {
  it("moves to its own review step and passes the corrected list onward", async () => {
    send.mockResolvedValue({ text: '{"lines":["bank n. 銀行與河岸"]}' });
    const confirm = vi.fn();
    render(<Host onConfirm={confirm} />);
    fireEvent.change(screen.getByLabelText(/單字與提示/), {
      target: { value: "bank 銀行 河岸" },
    });
    fireEvent.click(screen.getByRole("button", { name: "整理輸入" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
      ).toBeInTheDocument(),
    );
    // The step that produced the list is gone; only the list is being read.
    expect(screen.queryByLabelText(/單字與提示/)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    const review = screen.getByDisplayValue("bank n. 銀行與河岸");
    fireEvent.change(review, { target: { value: "bank n. 河岸" } });
    fireEvent.click(
      screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
    );
    expect(confirm).toHaveBeenCalledWith("bank n. 河岸");
    expect(send.mock.calls[0][0].tier).toBe("lite");
    expect(send.mock.calls[0][1].kind).toBe("organizeText");
  });

  it("goes back to the input without losing what was organized", async () => {
    send.mockResolvedValue({ text: '{"lines":["bank n. 銀行"]}' });
    render(<Host onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/單字與提示/), {
      target: { value: "bank 銀行" },
    });
    fireEvent.click(screen.getByRole("button", { name: "整理輸入" }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("bank n. 銀行")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "重新整理" }));
    expect(screen.getByLabelText(/單字與提示/)).toHaveValue("bank 銀行");
    fireEvent.click(screen.getByRole("button", { name: "查看結果" }));
    expect(screen.getByDisplayValue("bank n. 銀行")).toBeInTheDocument();
  });

  it("organizes ten selected photos, then asks whether there are more", async () => {
    readManagedStream.mockResolvedValue({
      text: '{"lines":["bank n. 銀行"]}',
    });
    render(<Host onConfirm={vi.fn()} />);
    const input = screen.getByLabelText(/選擇或拍攝照片/);
    expect(input).toHaveAttribute("multiple");
    const files = Array.from(
      { length: 10 },
      (_, index) =>
        new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(input, { target: { files } });
    await waitFor(() =>
      expect(screen.getByText("還有其他照片嗎？")).toBeInTheDocument(),
    );
    expect(encodeWordPhoto).toHaveBeenCalledTimes(10);
    expect(managedFetch).toHaveBeenCalledTimes(10);
    fireEvent.click(screen.getByRole("button", { name: "沒有了，檢查結果" }));
    expect(screen.getByRole("textbox")).toHaveValue(
      Array(10).fill("bank n. 銀行").join("\n"),
    );
  });

  it("organizes selections larger than ten in consecutive batches", async () => {
    readManagedStream.mockResolvedValue({
      text: '{"lines":["bank n. 銀行"]}',
    });
    render(<Host onConfirm={vi.fn()} />);
    const files = Array.from(
      { length: 11 },
      (_, index) =>
        new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(screen.getByLabelText(/選擇或拍攝照片/), {
      target: { files },
    });
    await waitFor(() => expect(managedFetch).toHaveBeenCalledTimes(11));
    expect(encodeWordPhoto).toHaveBeenCalledTimes(11);
    expect(screen.getByText("還有其他照片嗎？")).toBeInTheDocument();
  });

  it("shows the selected file and direct browser error for debugging", async () => {
    encodeWordPhoto.mockRejectedValue(new Error("WebP encoding exploded"));
    render(<Host onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/選擇或拍攝照片/), {
      target: {
        files: [new File(["photo"], "problem.heic", { type: "image/heic" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("problem.heic");
    expect(alert).toHaveTextContent("WebP encoding exploded");
  });

  it("turns an invalid-image response into an actionable message", async () => {
    encodeWordPhoto.mockRejectedValue(
      new AiRequestError("整理失敗", {
        code: "invalid_image",
        retryable: false,
      }),
    );
    render(<Host onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/選擇或拍攝照片/), {
      target: {
        files: [new File(["photo"], "IMG_0252.jpeg", { type: "image/jpeg" })],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "IMG_0252.jpeg：圖片編碼失敗。請重新選取；若仍失敗，先在「照片」中編輯並儲存副本。",
    );
  });
});

describe("photo encoding", () => {
  it("falls back to the WebP codec when Safari returns invalid bytes", async () => {
    const image = {
      naturalHeight: 1000,
      naturalWidth: 2000,
      onerror: null as null | (() => void),
      onload: null as null | (() => void),
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      },
    };
    const imageData = {
      data: new Uint8ClampedArray(),
      height: 900,
      width: 1800,
    };
    const context = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      getImageData: vi.fn(() => imageData),
    };
    const canvas = {
      height: 0,
      width: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback, type: string) =>
        callback(new Blob(["not-webp"], { type })),
      ),
    };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "img") return image as unknown as HTMLImageElement;
      if (tagName === "canvas") return canvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tagName);
    });
    Object.defineProperties(URL, {
      createObjectURL: {
        configurable: true,
        value: vi.fn(() => "blob:photo"),
      },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    const { encodeWordPhoto: encode } =
      await vi.importActual<typeof import("@/lib/word-photo")>(
        "@/lib/word-photo",
      );

    await expect(
      encode(new File(["photo"], "photo.heic", { type: "image/heic" })),
    ).resolves.toBeTruthy();
    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(900);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      0.85,
    );
    expect(encodeWebp).toHaveBeenCalledWith(imageData, { quality: 85 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });
});
