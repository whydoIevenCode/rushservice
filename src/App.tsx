import { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

type EmployeeReport = {
  id: number;
  name: string;
  orders: string;
  calls: string;
  volume: string;
  zacManager: string;
  customerService: string;
  behavioral: string;
  isWorkFromHome: boolean;
  noLateBonus: boolean;
  writeups: string;
  irCount: string;
};

type ScoreBreakdown = {
  orderPoints: number;
  callPoints: number;
  volumePoints: number;
  managerPoints: number;
  customerServicePoints: number;
  behavioralPoints: number;
  bonusPoints: number;
  totalPositive: number;
  totalDeductions: number;
  finalScore: number;
};

type ChartTab = "overall" | "orders" | "calls" | "volume";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const createReport = (id: number): EmployeeReport => ({
  id,
  name: "",
  orders: "",
  calls: "",
  volume: "",
  zacManager: "",
  customerService: "",
  behavioral: "",
  isWorkFromHome: false,
  noLateBonus: false,
  writeups: "",
  irCount: "",
});

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toOrdinal = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

const calculateScore = (report: EmployeeReport): ScoreBreakdown => {
  const orders = Math.max(0, toNumber(report.orders));
  const calls = Math.max(0, toNumber(report.calls));
  const volume = Math.max(0, toNumber(report.volume));
  const managerPoints = clamp(toNumber(report.zacManager), 0, 200);
  const customerServicePoints = clamp(toNumber(report.customerService), 0, 350);
  const behavioralPoints = clamp(toNumber(report.behavioral), 0, 200);
  const writeups = Math.max(0, toNumber(report.writeups));
  const irCount = Math.max(0, toNumber(report.irCount));

  const orderPoints = orders * 4;
  const callPoints = calls;
  const volumePoints = volume / 100;
  const bonusPoints = report.noLateBonus ? 100 : 0;

  const totalPositive =
    orderPoints +
    callPoints +
    volumePoints +
    managerPoints +
    customerServicePoints +
    behavioralPoints +
    bonusPoints;

  const totalDeductions = writeups * 2500 + irCount * 100;
  const finalScore = totalPositive - totalDeductions;

  return {
    orderPoints,
    callPoints,
    volumePoints,
    managerPoints,
    customerServicePoints,
    behavioralPoints,
    bonusPoints,
    totalPositive,
    totalDeductions,
    finalScore,
  };
};

const App = () => {
  const [reports, setReports] = useState<EmployeeReport[]>([createReport(1)]);
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  const [activeChart, setActiveChart] = useState<ChartTab>("overall");

  const rankedReports = useMemo(() => {
    const scored = reports.map((report, index) => ({
      report,
      index,
      score: calculateScore(report),
      rank: 0,
    }));

    const sorted = [...scored].sort((a, b) => b.score.finalScore - a.score.finalScore);
    sorted.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    const rankById = new Map<number, number>();
    sorted.forEach((item) => {
      rankById.set(item.report.id, item.rank);
    });

    return scored.map((item) => ({
      ...item,
      rank: rankById.get(item.report.id) ?? item.index + 1,
    }));
  }, [reports]);

  const updateReport = (
    id: number,
    field: keyof EmployeeReport,
    value: string | boolean,
  ) => {
    setReports((previous) =>
      previous.map((report) =>
        report.id === id ? { ...report, [field]: value } : report,
      ),
    );
  };

  const addReport = () => {
    setReports((previous) => [...previous, createReport(Date.now())]);
  };

  const removeReport = (id: number) => {
    setReports((previous) =>
      previous.length === 1 ? previous : previous.filter((report) => report.id !== id),
    );
  };

  const resetAll = () => {
    setReports([createReport(Date.now())]);
  };

  const participantLabels = useMemo(
    () =>
      rankedReports.map((item, index) => {
        const name = item.report.name.trim();
        return `${toOrdinal(item.rank)} - ${name || `Participant ${index + 1}`}`;
      }),
    [rankedReports],
  );

  const chartConfigs = useMemo(() => {
    const sharedStyle = {
      pointBorderColor: "#ffffff",
      pointRadius: 5,
      pointHoverRadius: 7,
      fill: true,
      tension: 0.3,
    };

    return {
      overall: {
        title: "Participant-to-Participant Overall Performance",
        yLabel: "Final Score",
        ySuffix: " pts",
        dataset: {
          label: "Final Score by Participant",
          data: rankedReports.map((item) => item.score.finalScore),
          borderColor: "#b91c1c",
          backgroundColor: "rgba(185, 28, 28, 0.18)",
          pointBackgroundColor: "#b91c1c",
          ...sharedStyle,
        },
      },
      orders: {
        title: "Orders Comparison by Participant",
        yLabel: "Order Count",
        ySuffix: "",
        dataset: {
          label: "Orders by Participant",
          data: rankedReports.map((item) => Math.max(0, toNumber(item.report.orders))),
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.18)",
          pointBackgroundColor: "#dc2626",
          ...sharedStyle,
        },
      },
      calls: {
        title: "Calls Comparison by Participant",
        yLabel: "Call Count",
        ySuffix: "",
        dataset: {
          label: "Calls by Participant",
          data: rankedReports.map((item) => Math.max(0, toNumber(item.report.calls))),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.18)",
          pointBackgroundColor: "#ef4444",
          ...sharedStyle,
        },
      },
      volume: {
        title: "Order Volume Comparison by Participant",
        yLabel: "Volume (USD)",
        ySuffix: " USD",
        dataset: {
          label: "Order Volume (USD) by Participant",
          data: rankedReports.map((item) => Math.max(0, toNumber(item.report.volume))),
          borderColor: "#f87171",
          backgroundColor: "rgba(248, 113, 113, 0.2)",
          pointBackgroundColor: "#f87171",
          ...sharedStyle,
        },
      },
    } satisfies Record<
      ChartTab,
      {
        title: string;
        yLabel: string;
        ySuffix: string;
        dataset: {
          label: string;
          data: number[];
          borderColor: string;
          backgroundColor: string;
          pointBackgroundColor: string;
          pointBorderColor: string;
          pointRadius: number;
          pointHoverRadius: number;
          fill: boolean;
          tension: number;
        };
      }
    >;
  }, [rankedReports]);

  const activeConfig = chartConfigs[activeChart];

  const chartData = useMemo(() => {
    return {
      labels: participantLabels,
      datasets: [activeConfig.dataset],
    };
  }, [participantLabels, activeConfig]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        title: {
          display: true,
          text: activeConfig.title,
        },
      },
      scales: {
        y: {
          beginAtZero: activeChart !== "overall",
          ticks: {
            callback: (value: string | number) => `${value}${activeConfig.ySuffix}`,
          },
          title: {
            display: true,
            text: activeConfig.yLabel,
          },
        },
      },
    }),
    [activeConfig, activeChart],
  );

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const now = new Date();
    doc.setFontSize(18);
    doc.setTextColor(140, 22, 22);
    doc.text("Rush Service Final Performance Report", 40, 45);

    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(`Generated: ${now.toLocaleString()}`, 40, 62);

    const tableBody = rankedReports.map((item, index) => {
      const score = item.score;
      return [
        String(index + 1),
        toOrdinal(item.rank),
        item.report.name.trim() || `Participant ${index + 1}`,
        score.orderPoints.toFixed(2),
        score.callPoints.toFixed(2),
        score.volumePoints.toFixed(2),
        score.managerPoints.toFixed(2),
        score.customerServicePoints.toFixed(2),
        score.behavioralPoints.toFixed(2),
        score.bonusPoints.toFixed(2),
        `-${score.totalDeductions.toFixed(2)}`,
        score.finalScore.toFixed(2),
      ];
    });

    autoTable(doc, {
      startY: 78,
      theme: "grid",
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 4 },
      head: [
        [
          "#",
          "Position",
          "Participant",
          "Orders",
          "Calls",
          "Volume",
          "Manager",
          "CS",
          "Behavior / Email&Comm",
          "Bonus",
          "Deductions",
          "Final",
        ],
      ],
      body: tableBody,
    });

    const chartImage = chartRef.current?.toBase64Image("image/png", 1);
    if (chartImage) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(140, 22, 22);
      doc.text(activeConfig.title, 40, 46);
      doc.addImage(chartImage, "PNG", 40, 62, 515, 300);
    }

    doc.save("rush-service-final-report.pdf");
  };

  return (
    <main className="page">
      <section className="layout">
        <header className="header">
          <div>
            <h1>Rush Service Performance Calculator</h1>
            <p>Create performance reports and export one final PDF for all participants.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-accent" onClick={addReport}>
              Add Report
            </button>
            <button type="button" className="btn btn-light" onClick={resetAll}>
              Reset All
            </button>
            <button type="button" className="btn btn-primary" onClick={exportPdf}>
              Export Final PDF
            </button>
          </div>
        </header>

        {reports.length >= 2 && (
          <section className="ranking-board">
            <h2>Live Ranking</h2>
            <div className="ranking-list">
              {[...rankedReports]
                .sort((a, b) => a.rank - b.rank)
                .map((item, index) => (
                  <article key={item.report.id} className={`rank-card rank-${item.rank}`}>
                    <span className="rank-pill">{toOrdinal(item.rank)}</span>
                    <strong>
                      {item.report.name.trim() || `Participant ${index + 1}`}
                    </strong>
                    <span>{item.score.finalScore.toFixed(2)} pts</span>
                  </article>
                ))}
            </div>
          </section>
        )}

        <section className="chart-board">
          <h2>Participant Comparison Chart</h2>
          <div className="chart-tabs">
            <button
              type="button"
              className={`tab-btn ${activeChart === "overall" ? "active" : ""}`}
              onClick={() => setActiveChart("overall")}
            >
              Overall Performance
            </button>
            <button
              type="button"
              className={`tab-btn ${activeChart === "orders" ? "active" : ""}`}
              onClick={() => setActiveChart("orders")}
            >
              Orders
            </button>
            <button
              type="button"
              className={`tab-btn ${activeChart === "calls" ? "active" : ""}`}
              onClick={() => setActiveChart("calls")}
            >
              Calls
            </button>
            <button
              type="button"
              className={`tab-btn ${activeChart === "volume" ? "active" : ""}`}
              onClick={() => setActiveChart("volume")}
            >
              Order Volume
            </button>
          </div>
          <div className="chart-wrap">
            <Line ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        </section>

        <section className="reports">
          {rankedReports.map((item, index) => {
            const report = item.report;
            const score = item.score;
            return (
              <article key={report.id} className="report-card">
                <div className="report-head">
                  <div className="report-title">
                    <h3>Report #{index + 1}</h3>
                    {reports.length >= 2 && (
                      <span className={`position-badge rank-${item.rank}`}>
                        {toOrdinal(item.rank)} Place
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-remove"
                    onClick={() => removeReport(report.id)}
                    disabled={reports.length === 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid">
                  <label>
                    Participant Name
                    <input
                      type="text"
                      value={report.name}
                      onChange={(event) =>
                        updateReport(report.id, "name", event.target.value)
                      }
                      placeholder="Employee name"
                    />
                  </label>
                </div>

                <h4>Performance</h4>
                <div className="grid">
                  <label>
                    Orders Placed
                    <input
                      type="number"
                      min="0"
                      value={report.orders}
                      onChange={(event) =>
                        updateReport(report.id, "orders", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Calls
                    <input
                      type="number"
                      min="0"
                      value={report.calls}
                      onChange={(event) =>
                        updateReport(report.id, "calls", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Total Order Volume (USD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={report.volume}
                      onChange={(event) =>
                        updateReport(report.id, "volume", event.target.value)
                      }
                    />
                  </label>
                </div>

                <h4>Manager Review</h4>
                <div className="grid">
                  <label>
                    Zac Manager Points (0-200)
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={report.zacManager}
                      onChange={(event) =>
                        updateReport(report.id, "zacManager", event.target.value)
                      }
                    />
                  </label>
                </div>

                <h4>Team Leader Review</h4>
                <div className="grid">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={report.isWorkFromHome}
                      onChange={(event) =>
                        updateReport(report.id, "isWorkFromHome", event.target.checked)
                      }
                    />
                    Is Work From Home
                  </label>
                  <label>
                    Customer Service Quality (0-350)
                    <input
                      type="number"
                      min="0"
                      max="350"
                      value={report.customerService}
                      onChange={(event) =>
                        updateReport(report.id, "customerService", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    {report.isWorkFromHome
                      ? "Email & Communication Quality (0-200)"
                      : "Behavioral Score (0-200)"}
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={report.behavioral}
                      onChange={(event) =>
                        updateReport(report.id, "behavioral", event.target.value)
                      }
                    />
                  </label>
                </div>

                <h4>Bonus & Deductions</h4>
                <div className="grid">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={report.noLateBonus}
                      onChange={(event) =>
                        updateReport(report.id, "noLateBonus", event.target.checked)
                      }
                    />
                    No Late Coming Bonus (+100)
                  </label>
                  <label>
                    Write-up Count (each -2500)
                    <input
                      type="number"
                      min="0"
                      value={report.writeups}
                      onChange={(event) =>
                        updateReport(report.id, "writeups", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    IR Count (each -100)
                    <input
                      type="number"
                      min="0"
                      value={report.irCount}
                      onChange={(event) =>
                        updateReport(report.id, "irCount", event.target.value)
                      }
                    />
                  </label>
                </div>

                <section className="breakdown">
                  <h4>Breakdown</h4>
                  <ul>
                    <li>
                      <span>Orders</span>
                      <strong>{score.orderPoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Calls</span>
                      <strong>{score.callPoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Volume</span>
                      <strong>{score.volumePoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Manager</span>
                      <strong>{score.managerPoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Customer Service</span>
                      <strong>{score.customerServicePoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>
                        {report.isWorkFromHome
                          ? "Email & Communication"
                          : "Behavioral"}
                      </span>
                      <strong>{score.behavioralPoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Bonus</span>
                      <strong>{score.bonusPoints.toFixed(2)} pts</strong>
                    </li>
                    <li>
                      <span>Deductions</span>
                      <strong className="negative">-{score.totalDeductions.toFixed(2)} pts</strong>
                    </li>
                  </ul>
                  <p className="final-score">
                    Final Score:{" "}
                    <strong className={score.finalScore < 0 ? "negative" : ""}>
                      {score.finalScore.toFixed(2)}
                    </strong>
                  </p>
                </section>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
};

export default App;
