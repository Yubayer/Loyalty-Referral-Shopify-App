import { ChartCard } from "./Cards";

export function PrizeChartsSection({ chartData, rangeKey, chartOptions }) {
    return (
        <ChartCard
            heading="Physical prize activity"
            chartKey={`prize-activity-${rangeKey}`}
            options={chartOptions(["#BA7517", "#378ADD", "#1D9E75", "#E24B4A"])}
            series={[
                { name: "Pending",   data: chartData.prizePending   },
                { name: "Fulfilled", data: chartData.prizeFulfilled },
                { name: "Completed", data: chartData.prizeCompleted },
                { name: "Cancelled", data: chartData.prizeCancelled },
            ]}
            type="area"
            height={320}
        />
    );
}
