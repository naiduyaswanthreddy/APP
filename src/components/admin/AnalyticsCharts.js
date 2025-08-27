import React from 'react';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement
);

const AnalyticsCharts = ({ 
  summaryData, 
  branchData, 
  companyData, 
  funnelData, 
  ctcDistribution, 
  eligibilityData,
  loading,
  onEligibleClick,
  onNotEligibleClick 
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
            <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgb(75, 85, 99)',
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: 'rgb(75, 85, 99)' },
        grid: { color: 'rgba(0, 0, 0, 0.1)' }
      },
      y: {
        ticks: { color: 'rgb(75, 85, 99)' },
        grid: { color: 'rgba(0, 0, 0, 0.1)' }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgb(75, 85, 99)',
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white'
      }
    }
  };

  return (
    <div className="space-y-8">
  


      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Department-wise Placement */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Department-wise Placement</h3>
          <div className="h-64">
            {branchData.labels && branchData.labels.length > 0 ? (
              <Bar data={branchData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No department data available
              </div>
            )}
          </div>
        </div>

        {/* Top Recruiting Companies */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Top Recruiting Companies</h3>
          <div className="h-64">
            {companyData.labels && companyData.labels.length > 0 ? (
              <Pie data={companyData} options={pieOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No company data available
              </div>
            )}
          </div>
        </div>

        {/* Application Funnel */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Application Funnel</h3>
          <div className="h-64">
            {funnelData.datasets && funnelData.datasets[0]?.data?.some(d => d > 0) ? (
              <Bar data={funnelData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No funnel data available
              </div>
            )}
          </div>
        </div>

        {/* CTC Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">CTC Distribution</h3>
          <div className="h-64">
            {ctcDistribution.datasets && ctcDistribution.datasets[0]?.data?.some(d => d > 0) ? (
              <Pie data={ctcDistribution} options={pieOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No CTC data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Eligibility Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Student Placement Eligibility</h3>
        <div className="flex justify-center">
          <div className="w-80 h-80">
            {eligibilityData && (eligibilityData.eligible > 0 || eligibilityData.notEligible > 0) ? (
              <Pie
                data={{
                  labels: ['Eligible', 'Not Eligible'],
                  datasets: [{
                    data: [eligibilityData.eligible, eligibilityData.notEligible],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',
                      'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                      'rgba(34, 197, 94, 1)',
                      'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 2
                  }]
                }}
                options={{
                  ...pieOptions,
                  onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                      const idx = elements[0].index;
                      if (idx === 0) onEligibleClick?.();
                      if (idx === 1) onNotEligibleClick?.();
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No eligibility data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
