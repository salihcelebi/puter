/*
  Bu dosya, worker klasöründeki ana AMG sözleşmesini tek noktada toplamak için bırakıldı.
  Eski dağınık chat/image/models worker dosyaları kontrollü sadeleştirme kapsamında kaldırıldı.
*/

const AMG = Object.freeze({
  name: 'amg',
  version: '1.0.0',
  endpoints: Object.freeze({
    modeller: '/api/modeller',
    sohbet: '/api/sohbet',
    sohbetAkis: '/api/sohbet/akis',
    gorsel: '/api/gorsel',
  }),
});

export default AMG;
