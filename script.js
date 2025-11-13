// script.js

// ===============================
// Constants & lookup tables
// ===============================

const RECS_AVG = 1839;

// Approx Texas scalar vs South average
const TEXAS_SCALAR = 1.30;

// Year built → cost + RSE
const AGE_DATA = [
  { label: "Before 1950", min: null, max: 1949, cost: 1959, rse: 2.52 },
  { label: "1950-1959",  min: 1950, max: 1959, cost: 1837, rse: 2.46 },
  { label: "1960-1969",  min: 1960, max: 1969, cost: 1844, rse: 1.86 },
  { label: "1970-1979",  min: 1970, max: 1979, cost: 1776, rse: 1.86 },
  { label: "1980-1989",  min: 1980, max: 1989, cost: 1797, rse: 1.85 },
  { label: "1990-1999",  min: 1990, max: 1999, cost: 1917, rse: 1.73 },
  { label: "2000-2009",  min: 2000, max: 2009, cost: 1891, rse: 1.55 },
  { label: "2010-2015",  min: 2010, max: 2015, cost: 1733, rse: 3.01 },
  { label: "2016-2020+", min: 2016, max: null, cost: 1670, rse: 2.99 }
];

// Sqft → cost + RSE
const SQFT_DATA = [
  { label: "<1000",      min: null, max: 999,  cost: 1248, rse: 1.58 },
  { label: "1000-1499",  min: 1000, max: 1499, cost: 1567, rse: 1.19 },
  { label: "1500-1999",  min: 1500, max: 1999, cost: 1908, rse: 1.06 },
  { label: "2000-2499",  min: 2000, max: 2499, cost: 2087, rse: 1.31 },
  { label: "2500-2999",  min: 2500, max: 2999, cost: 2340, rse: 1.53 },
  { label: "3000+",      min: 3000, max: null, cost: 2772, rse: 1.33 }
];

// Seasonal monthly multipliers (Texas-ish shape), normalized to mean 1.0
// Jan .. Dec
const SEASONAL_WEIGHTS = [
  0.829, // Jan
  0.780, // Feb
  0.878, // Mar
  0.976, // Apr
  1.073, // May
  1.171, // Jun
  1.268, // Jul
  1.268, // Aug
  1.122, // Sep
  0.927, // Oct
  0.878, // Nov
  0.829  // Dec
];

const MONTH_LABELS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

// ===============================
// Core lookup helpers
// ===============================

function matchRow(value, table) {
  return table.find(r =>
    (r.min === null || value >= r.min) &&
    (r.max === null || value <= r.max)
  );
}

// ===============================
// Main calculator (annual + CI)
// ===============================

function calcAnnual(year, sqft, scalar = TEXAS_SCALAR) {
  const age = matchRow(year, AGE_DATA);
  const sq  = matchRow(sqft, SQFT_DATA);
  if (!age || !sq) return null;

  // base model
  const sqftFactor = sq.cost / RECS_AVG;
  const annual = age.cost * sqftFactor * scalar;

  // SE propagation
  const age_cv  = age.rse / 100;
  const sqft_cv = sq.rse  / 100;
  const combined_cv = Math.sqrt(age_cv ** 2 + sqft_cv ** 2);
  const annual_se = annual * combined_cv;

  // 95% CI (z ≈ 1.96)
  const z = 1.96;
  const lo = annual - z * annual_se;
  const hi = annual + z * annual_se;

  return {
    annual,
    monthly: annual / 12,
    lo,
    hi,
    lo_month: lo / 12,
    hi_month: hi / 12
  };
}

// ===============================
// Chart handling
// ===============================

let seasonChart = null;

function buildSeasonalSeries(baseMonthly) {
  return SEASONAL_WEIGHTS.map(w => baseMonthly * w);
}

function updateSeasonChart(baseMonthly) {
  const ctx = document.getElementById("seasonChart").getContext("2d");
  const data = buildSeasonalSeries(baseMonthly);

  if (!seasonChart) {
    seasonChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: MONTH_LABELS,
        datasets: [{
          label: "Estimated Monthly Bill ($)",
          data: data,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Dollars per month" }
          }
        }
      }
    });
  } else {
    seasonChart.data.datasets[0].data = data;
    seasonChart.update();
  }
}

// ===============================
// UI wiring
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("calc").addEventListener("click", () => {
    const year = parseInt(document.getElementById("year").value, 10);
    const sqft = parseInt(document.getElementById("sqft").value, 10);
    let scalar = parseFloat(document.getElementById("scalar").value);

    if (isNaN(scalar) || scalar <= 0) scalar = TEXAS_SCALAR;

    const out = calcAnnual(year, sqft, scalar);
    const resultDiv = document.getElementById("result");

    if (!out) {
      resultDiv.innerHTML = "Please enter a valid year and square footage.";
      return;
    }

    resultDiv.innerHTML = `
      <p><strong>Monthly:</strong> $${out.monthly.toFixed(0)}</p>
      <p><strong>Annual:</strong> $${out.annual.toFixed(0)}</p>
      <p><strong>95% CI (monthly):</strong> $${out.lo_month.toFixed(0)} – $${out.hi_month.toFixed(0)}</p>
      <p><strong>95% CI (annual):</strong> $${out.lo.toFixed(0)} – $${out.hi.toFixed(0)}</p>
    `;

    updateSeasonChart(out.monthly);
  });

});

