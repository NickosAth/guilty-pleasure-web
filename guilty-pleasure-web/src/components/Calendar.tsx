import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeToday(date: Date) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return target < today;
}

export default function Calendar({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [month, setMonth] = useState(
    new Date(
      value.getFullYear(),
      value.getMonth(),
      1
    )
  );

  useEffect(() => {
    setMonth(
      new Date(
        value.getFullYear(),
        value.getMonth(),
        1
      )
    );
  }, [value]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDay = new Date(
    year,
    monthIndex,
    1
  );

  const firstWeekday =
    (firstDay.getDay() + 6) % 7;

  const daysInMonth = new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

  const today = new Date();

  const previousMonth = () => {
    const previous = new Date(
      year,
      monthIndex - 1,
      1
    );

    // Don't allow navigation before current month
    const currentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    if (previous < currentMonth) return;

    setMonth(previous);
  };

  const nextMonth = () => {
    setMonth(
      new Date(
        year,
        monthIndex + 1,
        1
      )
    );
  };

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push(
      <div
        className="cal-day empty"
        key={`empty-${i}`}
      />
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(
      year,
      monthIndex,
      day
    );

    const isSunday = date.getDay() === 0;
    const disabled = isBeforeToday(date) || isSunday;

    cells.push(
      <button
        type="button"
        key={day}
        disabled={disabled}
        className={[
          'cal-day',
          isSameDay(date, value)
            ? 'selected'
            : '',
          isSameDay(date, today)
            ? 'today'
            : '',
          isSunday
            ? 'sunday'
            : '',
          disabled
            ? 'disabled'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (!disabled) {
            onChange(date);
          }
        }}
        title={isSunday ? 'Κυριακή: το κατάστημα είναι κλειστό' : undefined}
      >
        {day}
      </button>
    );
  }

  const monthName = month.toLocaleDateString(
    'el-GR',
    {
      month: 'long',
      year: 'numeric',
    }
  );

  const isCurrentMonth =
    year === today.getFullYear() &&
    monthIndex === today.getMonth();

  return (
    <div className="calendar">
      <div className="cal-head">
        <button
          type="button"
          disabled={isCurrentMonth}
          onClick={previousMonth}
          aria-label="Προηγούμενος μήνας"
        >
          <ChevronLeft size={20} />
        </button>

        <strong>
          {monthName.charAt(0).toUpperCase() +
            monthName.slice(1)}
        </strong>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Επόμενος μήνας"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="weekdays">
        {[
          'Δε',
          'Τρ',
          'Τε',
          'Πε',
          'Πα',
          'Σα',
          'Κυ',
        ].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells}
      </div>
    </div>
  );
}