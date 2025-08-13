import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#ffffff'
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2563eb'
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    color: '#1f2937'
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#4b5563'
  },
  value: {
    width: '70%',
    color: '#1f2937'
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
    color: '#4b5563'
  },
  header: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1f2937'
  },
  subheader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#4b5563'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#9ca3af'
  }
});

const ResumePDF = ({ resumeData }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* About Me Section */}
        {resumeData['About Me'] && (
          <View>
            <Text style={styles.title}>{resumeData['About Me'].name}</Text>
            <View style={styles.row}>
              <Text style={styles.text}>{resumeData['About Me'].mobile} • {resumeData['About Me'].email}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.text}>LinkedIn: {resumeData['About Me'].linkedin} • GitHub: {resumeData['About Me'].github}</Text>
            </View>
          </View>
        )}

        {/* Experience Section */}
        {resumeData['Experience'] && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Experience</Text>
            {resumeData['Experience'].experiences.map((exp, index) => (
              <View key={index} style={{ marginBottom: 10 }}>
                <View style={styles.row}>
                  <Text style={styles.header}>{exp.position} at {exp.company}</Text>
                  <Text style={{ ...styles.text, textAlign: 'right' }}>{exp.duration}</Text>
                </View>
                <Text style={styles.text}>{exp.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Education Section */}
        {resumeData['Education'] && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Education</Text>
            {(resumeData['Education'].entries || []).map((ed, idx) => (
              <View key={idx} style={{ marginBottom: 8 }}>
                <Text style={styles.header}>{ed.institution} — {ed.degree}</Text>
                <Text style={styles.text}>{ed.period} • {ed.score}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills Section */}
        {resumeData['Skills'] && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Skills</Text>
            <Text style={styles.text}>{(resumeData['Skills'].items || []).join(', ')}</Text>
          </View>
        )}

        {/* Projects Section */}
        {resumeData['Projects'] && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Projects</Text>
            {(resumeData['Projects'].projects || []).map((p, idx) => (
              <View key={idx} style={{ marginBottom: 8 }}>
                <Text style={styles.header}>{p.name}</Text>
                <Text style={styles.text}>{p.description}</Text>
                <Text style={styles.text}>{p.techStack}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications Section */}
        {resumeData['Certifications'] && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Certifications</Text>
            {(resumeData['Certifications'].items || []).map((c, idx) => (
              <Text key={idx} style={styles.text}>{c.name} — {c.issuer}</Text>
            ))}
          </View>
        )}

        {/* Custom Sections */}
        {Object.keys(resumeData).filter(key => 
          !['About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications'].includes(key)
        ).map(sectionName => (
          <View key={sectionName} style={styles.section}>
            <Text style={styles.subtitle}>{sectionName}</Text>
            {/* Implement based on your custom section structure */}
            <Text style={styles.text}>{JSON.stringify(resumeData[sectionName])}</Text>
          </View>
        ))}

        <Text style={styles.footer}>Generated with APP Resume Maker</Text>
      </Page>
    </Document>
  );
};

export default ResumePDF;