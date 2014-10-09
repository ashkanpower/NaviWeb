<section>

  <style>

    .map{
    width:100%;
        height:700px;
       
    }

</style>



<div id="map" class="map"></div>

<button id="refresh" type="button" style="position:absolute; bottom:20px; right:20px; z-index:20000; padding:20px;">refresh</button>

<script type="text/javascript">

  $(document).ready(function () {

      $('#map').height($(window).height());


      var map;
      function initMap() {
          map = new OpenLayers.Map({
              div: "map",
              allOverlays: true,
              layers: [
              new OpenLayers.Layer.OSM("MyTiles", "tiles/${z}/${x}/${y}.png", {
                  numZoomLevels: 24,
                  isBaseLayer: false
              })
              ]
          });
          map.setCenter(new OpenLayers.LonLat(52.5198, 29.6164).transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913")), 5);
      }

      initMap();


      var pointId = 0;

      function poi(device, lat, long, date, speed, icon) {

          var fpoint = new OpenLayers.Geometry.Point(long,lat).transform(
          new OpenLayers.Projection("EPSG:4326"),  new OpenLayers.Projection("EPSG:900913"));

          var attributes = {
              'name': device,
              'lon': long,
              'lat': lat,
              'date' : date,
              'speed' : speed
          };

          var marker = new OpenLayers.Feature.Vector(fpoint, attributes, {
              externalGraphic: icon,
              graphicWidth: 24,
              graphicHeight: 24,
              fillOpacity: 1
          });

          marker.id = "devicePoint" + (pointId++);

          return marker;
      };




      function pointOnMap(layerId, lat, lon, desc, icon) {

          var point =  poi("1", lat, lon, "1392/05/08 12:20", 80, icon||"img/current_point.png");

          getLayerPoint('layer' + layerId).addFeatures([point]);

      }

      function drawLine(layerId, from, to){

          var start_point = new OpenLayers.Geometry.Point(from.lon, from.lat);
          start_point.transform(
          new OpenLayers.Projection("EPSG:4326"),
          new OpenLayers.Projection("EPSG:900913")
          );

          var end_point = new OpenLayers.Geometry.Point(to.lon, to.lat);
          end_point.transform(
          new OpenLayers.Projection("EPSG:4326"),
          new OpenLayers.Projection("EPSG:900913")
          );

          getLayerLine('linelayer' + layerId).addFeatures([new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString([start_point, end_point]))]);
      }

      $("#refresh").click(function () {

          //getLayerPoint('layer1').destroyFeatures();
          //getLayerLine('linelayer1').destroyFeatures();


          $.ajax({
              url: "http://<%= serverAddress %>/getLocations",
              type: "GET",
              success: function (data, textStatus, jqXHR) {

                  
                  var lat;
                  var lon
                  var loc;

                  for (var k = 0; k < data.length; k++) {

                      var device = data[k];
                      var device_id = device.device_id;
                      var locations = device.locations;

                      var lastPoint;

                      for (var i = 0; i < locations.length; i++) {

                          loc = locations[i];

                          lat = loc.location_lat;
                          lon = loc.location_lon;
                        
                          loc.lat = lat;
                          loc.lon = lon;

                          if(i==0){
                              console.log('i==0');
                              lastPoint = loc;
                              pointOnMap(loc.location_device_id, lat, lon, "","img/start_point.png");
                          }

                          if(!lastPoint)
                              lastPoint = loc;
                          else{
                              drawLine(loc.location_device_id, lastPoint, loc);
                              lastPoint = loc;
                          }
                      
                          console.log(lat, lon);
                      }

                      pointOnMap(loc.location_device_id, lat, lon, "");
                     
                  }

              },
              error: function (jqXHR, textStatus, errorThrown) {

              }
          });
              

      });

      var layerDict = {};
      var layers = [];

      var myControl;

      function getLayerPoint(layerName){

          var layer = layerDict[layerName];

          if(!layer){
              //new layer
              layer = new OpenLayers.Layer.Vector(layerName);
              
              if(myControl)
                map.removeControl(myControl);

              myControl = new OpenLayers.Control.SelectFeature(layers, {
                  hover: true,
                  highlightOnly: true,
                  eventListeners: {
                      featurehighlighted:  function(olEvent){
                          var attr = olEvent.feature.attributes;

                          $('#' + olEvent.feature.geometry.id).qtip({
                              content: {
                                  text: $('<div style="width:100px; "><span>device name : '+ attr.name +'</span><span> location: '+ attr.lat +' , '+ attr.lon +' </span><br /><span> date : '+ attr.date +' </span></div>')
                              },
                              position: {
                                  my: 'bottom center',
                                  at: 'top center'
                              },
                              style: {
                                  classes: 'qtip-green'
                              }
                          });
                          $('#' + olEvent.feature.geometry.id).qtip('show');

                      },
                      featureunhighlighted: function(olEvent){
                          $('#' + olEvent.feature.geometry.id).qtip('hide');
                      }
                  }
              });

              

             
              map.addControl(myControl);
              myControl.activate();

              map.addLayer(layer);
              
              layerDict[layerName] = layer;
              layers.push(layer);
          }




          return layer;

      }

      function getLayerLine(layerName){

          var layer = layerDict[layerName];

          if(!layer){
              //new layer

              var color;
              var r = Math.floor(Math.random() * 70) + 100;
              var g = Math.floor(Math.random() * 70) + 100;
              var b = Math.floor(Math.random() * 70) + 100;
              color= "rgb("+r+" ,"+g+","+ b+")"; 

              layer = new OpenLayers.Layer.Vector('layerName', {
                  styleMap: new OpenLayers.StyleMap({'default':{
                      pointRadius: 6,
                      strokeColor: color,
                      strokeOpacity: 1.0,
                      strokeWidth: 6
                  }})
              });

              map.addLayer(layer);


              layerDict[layerName] = layer;
          }

          return layer;

      }

  });

</script>
</section>