/*
  Bu dosya, worker klasöründeki ana AMH orkestrasyon sözleşmesini tek noktada toplamak için bırakıldı.
  Amaç, fallback/orkestrasyon çağrılarını tek bir endpointte tutmaktır.
*/

const AMH = Object.freeze({
  name: 'amh',
  version: '1.0.0',
  endpoint: '/api/calistir',
  serviceTypes: Object.freeze(['CHAT', 'IMG', 'VIDEO', 'TTS', 'OCR', 'PDF', 'DEEPSEARCH']),
});

export default AMH;
