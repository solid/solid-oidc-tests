"use strict";

function createEntry(data) {
  // Build row
  const row = document.createElement('tr');

  // Build label
  const label = document.createElement('td');
  label.classList.add('label');
  label.appendChild(document.createTextNode(data.label));

  // Build level
  const level = document.createElement('td');
  level.classList.add('level');
  level.classList.add(data.level);
  level.appendChild(document.createTextNode(data.level));

  // Build status
  const status = document.createElement('td');
  status.classList.add('status');
  status.classList.add(data.status);

  // Build description
  const description = document.createElement('td');
  description.classList.add('detail');
  description.appendChild(document.createTextNode(data.description));

  // Build source
  if (data.uri) {
    const source = document.createElement('a');
    source.classList.add('source');
    source.setAttribute('href', data.uri);
    source.appendChild(document.createTextNode('[Source]'))
    description.appendChild(source);
  }

  if (data.message) {
    description.appendChild(document.createElement('br'));
    description.appendChild(document.createTextNode(data.message));
  }

  // Build result item
  row.appendChild(label);
  row.appendChild(level);
  row.appendChild(status);
  row.appendChild(description);
  return row;
}

function createHeading() {
  const heading = document.createElement('tr');
  const label = document.createElement('th');
  label.appendChild(document.createTextNode('Label'));
  heading.appendChild(label);

  const level = document.createElement('th');
  level.appendChild(document.createTextNode('Level'));
  heading.appendChild(level);

  const status = document.createElement('th');
  status.appendChild(document.createTextNode('Status'));
  heading.appendChild(status);

  const description = document.createElement('th');
  description.appendChild(document.createTextNode('Description'));
  heading.appendChild(description);
  return heading;
}

function fetchToken(oidc, issuer, code, verifier) {
  const openid = new OpenId(issuer);
  return crypto.subtle.generateKey(oidc.algorithm, false, ['sign', 'verify'])
          .then(key => new DPoP(key))
          .then(dpop => openid.token(oidc.clientId, oidc.redirectUri, code, verifier, dpop));
}

function getSpecData(location) {
  return fetch(location).then(res => res.json());
}

((config) => {
  const report = document.getElementById('report');
  const state = {};

  document.getElementById('solid-oidc').addEventListener('submit', (evt) => {
    evt.preventDefault();
    state.authnWindow = window.open(config.redirectUri, config.windowName, config.windowFeatures);
    report.querySelectorAll('table').forEach(elem => {
      while (elem.firstChild) elem.removeChild(elem.firstChild);
    });
    document.querySelectorAll('h2.issuer').forEach(elem => {
      while (elem.firstChild) elem.removeChild(elem.firstChild);
    });
  });

  window.onmessage = (evt) => {
    if (evt.origin === window.location.origin) {
      // Events from a running test suite
      if (evt.source === window.top) {

        // Add to DOM
        report.querySelector('table').appendChild(createEntry(evt.data));

      // Events from the authentication window
      } else if (evt.source === state.authnWindow) {

        // Retrieve issuer and verifier
        if (evt.data?.issuer && evt.data?.verifier) {
          state.issuer = evt.data.issuer;
          state.verifier = evt.data.verifier;

          report.querySelector('table').appendChild(createHeading());
          document.querySelector('h2.issuer')
            .appendChild(document.createTextNode(`Conformance report for ${state.issuer}`));

          const openid = new OpenId(state.issuer);
          Promise.all([getSpecData(config.specificationData), openid.metadata()])
            .then(([spec, oidc]) => new DiscoverySuite(spec, oidc).run());

        // Retrieve code for authorization_code flow
        } else if (evt.data?.code) {
          const openid = new OpenId(state.issuer);
          openid.metadata().then(oidc =>
            Promise.all([
                getSpecData(config.specificationData),
                fetchToken(config, oidc.issuer, evt.data.code, state.verifier)])
              .then(([spec, token]) => new IDTokenSuite(spec, config.clientId, oidc.issuer, token).run()));

        // Retrieve any errors
        } else if (evt.data?.error) {
          document.querySelector('div.message').appendChild(document.createTextNode(evt.data.error_description));
        }
      }
    }
  };
})(CONFIG);