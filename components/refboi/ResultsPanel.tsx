interface ResultsPanelProps {
  bpm: number;
  musicalKey: string;
  lufs: number;
}

export default function ResultsPanel({ bpm, musicalKey, lufs }: ResultsPanelProps) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1.5rem" }}>
      <tbody>
        <tr>
          <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>BPM</td>
          <td>{bpm}</td>
        </tr>
        <tr>
          <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>Key</td>
          <td>{musicalKey}</td>
        </tr>
        <tr>
          <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>LUFS</td>
          <td>{lufs} LUFS</td>
        </tr>
      </tbody>
    </table>
  );
}
