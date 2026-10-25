import Icon from './Icon';

export default function SubmissionGuide({ entry, venues }) {
  const fit = entry.paperFit;
  if (!fit?.guide) return null;
  const comparisons = fit.guide.comparisons.map(comparison => ({
    ...comparison,
    venue: venues.find(venue => venue.series === comparison.series),
  })).filter(comparison => comparison.venue);

  return (
    <section className="submission-guide" aria-labelledby={`guide-${entry.id}`}>
      <div className="guide-heading">
        <h3 id={`guide-${entry.id}`}>Submission guide</h3>
        <a className="text-link" href={fit.source} target="_blank" rel="noreferrer" title={`Source checked ${fit.checkedAt}`}>
          Proceedings ({fit.basisYear})<Icon name="arrow" size={13} />
        </a>
      </div>
      <div className="guide-grid">
        <div className="guide-expectations">
          <h4>Expected Contribution</h4>
          <p>{fit.guide.contribution}</p>
          <h4>Expected Evaluation</h4>
          <p>{fit.guide.evidence}</p>
        </div>
        <div className="guide-comparisons">
          <h4>{entry.name} compared with</h4>
          <ul>
            {comparisons.map(({ series, difference, venue }) => (
              <li key={series}>
                <a href={venue.paperFit.source} target="_blank" rel="noreferrer" title={`${venue.name} proceedings`}>
                  {venue.name}<span>{venue.paperFit.basisYear}</span><Icon name="arrow" size={13} />
                </a>
                <p>{difference}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
