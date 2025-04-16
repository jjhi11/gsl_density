import React from 'react';

/**
 * Component for the interpretation guide section
 */
const InfoPanel = () => {
  // Custom styles for properly aligned bullets
  const styles = {
    container: {
      borderTop: '1px solid #e5e7eb',
      paddingTop: '1rem',
      marginTop: '0.5rem'
    },
    heading: {
      fontWeight: 'bold',
      marginBottom: '0.5rem',
      fontSize: '1.125rem',
      color: '#1e40af'
    },
    contentBox: {
      backgroundColor: '#eff6ff',
      padding: '1rem',
      borderRadius: '0.5rem'
    },
    list: {
      textAlign: 'left',
      paddingLeft: '1.25rem', // Reduce the left padding to bring bullets closer
      color: '#374151',
      margin: 0
    },
    listItem: {
      margin: '0.25rem 0'
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Interpretation Guide</h3>
      <div style={styles.contentBox}>
        <ul style={styles.list}>
          <li style={styles.listItem}>Heatmap shows interpolated density (darker blue = higher g/cm³) or salinity (darker green = higher g/L).</li>
          <li style={styles.listItem}>Circles are sampling stations; color matches legend if data exists.</li>
          <li style={styles.listItem}>Use slider or play button to view monthly changes (2000-2025).</li>
          <li style={styles.listItem}><strong>Click on any station</strong> to view its data in a time series chart.</li>
          <li style={styles.listItem}>Observe potential correlations between temperature (Avg Temp) and the selected variable patterns.</li>
          <li style={styles.listItem}>Data is interpolated between stations using inverse distance weighting.</li>
        </ul>
      </div>
    </div>
  );
};

export default InfoPanel;