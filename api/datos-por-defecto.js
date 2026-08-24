// Contenido por defecto de cada juego.
//
// Solo se usa para SEMBRAR un fichero que todavía no exista en DATA_DIR.
// Una vez creado el JSON en disco, esa es la única fuente de verdad y
// este fichero no se vuelve a consultar — por eso un despliegue nuevo
// nunca pisa las frases añadidas desde el panel. Ver sembrarSiFalta().
module.exports = {

  'yo-nunca': {
    categorias: [
      { id: 'suave', name: 'Suave', emoji: '🍺', desc: 'Para todos los públicos. Perfecto para calentar.' },
      { id: 'fiesta', name: 'Fiesta', emoji: '🎉', desc: 'Borracheras, noches locas y caos total.' },
      { id: 'picante', name: 'Picante +18', emoji: '🔥', desc: 'Solo para adultos. Contenido subido de tono.' },
    ],
    frases: [
      // ── SUAVE ──
      { texto: 'he mentido para salir de un compromiso', categoria: 'suave' },
      { texto: 'he comido directamente del bote sin usar cubiertos', categoria: 'suave' },
      { texto: 'he enviado un mensaje al destinatario equivocado', categoria: 'suave' },
      { texto: 'he fingido no haber visto un mensaje', categoria: 'suave' },
      { texto: 'he llorado con una película de animación', categoria: 'suave' },
      { texto: 'he hecho trampa en un juego de mesa', categoria: 'suave' },
      { texto: 'he googleado mi propio nombre', categoria: 'suave' },
      { texto: 'he fingido estar ocupado para no salir', categoria: 'suave' },
      { texto: 'he cantado en el coche como si fuera un concierto', categoria: 'suave' },
      { texto: 'he olvidado el cumpleaños de alguien importante', categoria: 'suave' },
      { texto: 'he leído el final de un libro antes de terminarlo', categoria: 'suave' },
      { texto: 'me he quedado dormido viendo una película', categoria: 'suave' },
      { texto: 'he comprado algo y luego dicho que lo tenía de antes', categoria: 'suave' },
      { texto: 'he cancelado planes en el último momento sin motivo real', categoria: 'suave' },

      // ── FIESTA ──
      { texto: 'he vomitado en la calle de tanto beber', categoria: 'fiesta' },
      { texto: 'he ligado en una boda', categoria: 'fiesta' },
      { texto: 'he bailado encima de una silla o una mesa', categoria: 'fiesta' },
      { texto: 'he acabado una noche sin recordar cómo llegué a casa', categoria: 'fiesta' },
      { texto: 'he pedido al DJ que me pusiera una canción', categoria: 'fiesta' },
      { texto: 'he besado a dos personas distintas en la misma noche', categoria: 'fiesta' },
      { texto: 'he perdido el móvil de fiesta', categoria: 'fiesta' },
      { texto: 'me he quedado dormido en una fiesta', categoria: 'fiesta' },
      { texto: 'he ido a trabajar sin dormir tras una noche de fiesta', categoria: 'fiesta' },
      { texto: 'me he colado en una discoteca sin pagar', categoria: 'fiesta' },
      { texto: 'he hecho el "Walk of shame" a la mañana siguiente', categoria: 'fiesta' },
      { texto: 'he llamado a mi ex a las 3 de la mañana', categoria: 'fiesta' },
      { texto: 'he perdido un zapato o prenda de ropa de fiesta', categoria: 'fiesta' },
      { texto: 'he tenido que buscar mi coche al día siguiente porque no recordaba dónde lo dejé', categoria: 'fiesta' },

      // ── PICANTE ──
      { texto: 'he mandado una foto comprometedora', categoria: 'picante' },
      { texto: 'he tenido relaciones en un sitio público', categoria: 'picante' },
      { texto: 'he practicado sexting', categoria: 'picante' },
      { texto: 'he mentido sobre el número de personas con las que he estado', categoria: 'picante' },
      { texto: 'he tenido una noche de una sola vez', categoria: 'picante' },
      { texto: 'he fantaseado con alguien de aquí presente', categoria: 'picante' },
      { texto: 'he visto contenido para adultos en el trabajo o en clase', categoria: 'picante' },
      { texto: 'he usado una aplicación de citas', categoria: 'picante' },
      { texto: 'he tenido una relación secreta que nadie conocía', categoria: 'picante' },
      { texto: 'he hecho un striptease', categoria: 'picante' },
      { texto: 'he roto algo durante el sexo', categoria: 'picante' },
      { texto: 'he fingido un orgasmo', categoria: 'picante' },
      { texto: 'he besado a alguien del mismo sexo', categoria: 'picante' },
      { texto: 'he tenido relaciones con alguien mucho mayor o menor que yo', categoria: 'picante' },
    ],
  },

  'quien-es-mas-probable': {
    categorias: [
      { id: 'amigos', name: 'Amigos', emoji: '👥', desc: 'Del grupo y del día a día. Para todos los públicos.' },
      { id: 'fiesta', name: 'Fiesta', emoji: '🎉', desc: 'Borracheras, noches locas y caos total.' },
      { id: 'picante', name: 'Picante +18', emoji: '🔥', desc: 'Solo para adultos. Contenido subido de tono.' },
    ],
    frases: [
      // ── AMIGOS ──
      { texto: 'se quede dormido en el cine', categoria: 'amigos' },
      { texto: 'llegue tarde a su propia boda', categoria: 'amigos' },
      { texto: 'se haga rico sin dar un palo al agua', categoria: 'amigos' },
      { texto: 'acabe viviendo en otro país', categoria: 'amigos' },
      { texto: 'se deje el móvil en el bar', categoria: 'amigos' },
      { texto: 'llore viendo un anuncio', categoria: 'amigos' },
      { texto: 'se apunte a un gimnasio y no vaya nunca', categoria: 'amigos' },
      { texto: 'discuta con un desconocido por internet', categoria: 'amigos' },
      { texto: 'se pierda usando el GPS', categoria: 'amigos' },
      { texto: 'cuente el mismo chiste tres veces', categoria: 'amigos' },
      { texto: 'se gaste el sueldo en una tontería', categoria: 'amigos' },
      { texto: 'olvide el cumpleaños de alguien del grupo', categoria: 'amigos' },
      { texto: 'monte un drama por el grupo de WhatsApp', categoria: 'amigos' },
      { texto: 'acabe siendo el más responsable de todos', categoria: 'amigos' },

      // ── FIESTA ──
      { texto: 'acabe bailando encima de la barra', categoria: 'fiesta' },
      { texto: 'sea el primero en caer borracho', categoria: 'fiesta' },
      { texto: 'invite a una ronda a todo el bar', categoria: 'fiesta' },
      { texto: 'pierda las llaves de casa esta noche', categoria: 'fiesta' },
      { texto: 'acabe durmiendo en un sitio raro', categoria: 'fiesta' },
      { texto: 'llame a su ex de madrugada', categoria: 'fiesta' },
      { texto: 'se cuele en una discoteca sin pagar', categoria: 'fiesta' },
      { texto: 'proponga seguir la fiesta a las 6 de la mañana', categoria: 'fiesta' },
      { texto: 'se quede dormido en el taxi de vuelta', categoria: 'fiesta' },
      { texto: 'acabe cantando karaoke sin que nadie se lo pida', categoria: 'fiesta' },
      { texto: 'se pelee con la máquina de tabaco', categoria: 'fiesta' },
      { texto: 'termine la noche comiendo en un kebab', categoria: 'fiesta' },
      { texto: 'suba una story de la que se arrepienta', categoria: 'fiesta' },
      { texto: 'convenza a todos de ir a otro sitio', categoria: 'fiesta' },

      // ── PICANTE ──
      { texto: 'mande un nude por error', categoria: 'picante' },
      { texto: 'tenga una cita a ciegas esta semana', categoria: 'picante' },
      { texto: 'se líe con alguien del grupo', categoria: 'picante' },
      { texto: 'tenga más apps de citas instaladas', categoria: 'picante' },
      { texto: 'haya mentido sobre su número', categoria: 'picante' },
      { texto: 'se enrolle con un desconocido esta noche', categoria: 'picante' },
      { texto: 'tenga el historial de búsqueda más sucio', categoria: 'picante' },
      { texto: 'haya tenido una aventura de una noche', categoria: 'picante' },
      { texto: 'se atreva a hacer un striptease', categoria: 'picante' },
      { texto: 'guarde un secreto sexual del grupo', categoria: 'picante' },
      { texto: 'vuelva con su ex aunque jure que no', categoria: 'picante' },
      { texto: 'haya fingido un orgasmo', categoria: 'picante' },
      { texto: 'se lo haya montado en un sitio público', categoria: 'picante' },
      { texto: 'tenga la fantasía más rara', categoria: 'picante' },
    ],
  },

};
