type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
};

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-white border border-[#DCE6DE] rounded-md px-5 py-4">
      <div className="text-xs font-medium text-[#5C6E62] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          accent ? "text-[#176B4D]" : "text-[#202923]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-[#5C6E62] mt-0.5">{sub}</div>}
    </div>
  );
}
