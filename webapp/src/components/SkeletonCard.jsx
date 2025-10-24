import React from 'react';

const SkeletonCard = ({ lines = 3 }) => (
    <div className="card skeleton-card" aria-hidden>
        {[...Array(lines)].map((_, index) => (
            <div key={index} className={`skeleton-line skeleton-line-${index}`} />
        ))}
    </div>
);

export default SkeletonCard;
